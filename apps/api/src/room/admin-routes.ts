import { adminRoomListSchema, gameIdSchema, lobbySnapshotSchema } from "@26/shared";
import type { Hono } from "hono";
import { z } from "zod";
import {
  acceptedMediaHeaders,
  hiddenMediaHeaders,
  readAcceptedBytes,
} from "../media/finalise.ts";
import { r2ObjectStore } from "../media/store.ts";
import { jsonData } from "../auth/http.ts";
import {
  readCredentialCookie,
  serializeCredentialCookie,
} from "../credentials/cookies.ts";
import { credentialLifetimeMs } from "../credentials/verify.ts";
import { rejectUnlessRoomCreator } from "./access.ts";
import { rejectOldKartTrackClient } from "./kart-track-compatibility.ts";

// This cookie is a location hint, never authority. Every read verifies control
// credentials against the selected room; tampering cannot select another room.
export function selectedRoomCookie(gameId: string): string {
  return `26_admin_room=${gameId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(credentialLifetimeMs("control") / 1000)}`;
}

function selectedRoom(request: Request): string | undefined {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("26_admin_room="))
    ?.slice("26_admin_room=".length);
  const parsed = gameIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function releasePreviousAdmin(
  request: Request,
  env: Env,
  now: string,
  keep?: { control: { credentialId: string }; presentation: { credentialId: string } },
) {
  const previous = selectedRoom(request);
  if (!previous) return;
  for (const role of ["control", "presentation"] as const) {
    const old = readCredentialCookie(request.headers.get("cookie") ?? undefined, role);
    if (old && old.credentialId !== keep?.[role].credentialId)
      await env.PARTY_ROOM.getByName(previous).releaseAdmin({ ...old, role, now });
  }
}

export function registerAdminRoomRoutes(app: Hono<{ Bindings: Env }>): void {
  app.use("/api/admin/rooms", async (c, next) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    await next();
  });
  app.use("/api/admin/rooms/*", async (c, next) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    await next();
  });
  app.get("/api/admin/rooms", async (c) => {
    const cursor = c.req.query("cursor");
    const limit = Number(c.req.query("limit") ?? "20");
    if (
      (cursor !== undefined &&
        (!/^[1-9]\d{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return failure(400, "Choose a valid room-list page.");
    }
    return jsonData(
      adminRoomListSchema.parse(
        await c.env.ROOM_CODE_REGISTRY.getByName("codes").listRooms({
          before: cursor ? Number(cursor) : undefined,
          limit,
        }),
      ),
    );
  });
  app.get("/api/admin/rooms/current", async (c) => {
    const gameId = selectedRoom(c.req.raw);
    if (!gameId) return jsonData({ snapshot: null });
    const credential = readCredentialCookie(c.req.header("cookie"), "control");
    if (!credential) return jsonData({ snapshot: null });
    const found = await c.env.PARTY_ROOM.getByName(gameId).adminRoom({
      ...credential,
      now: new Date().toISOString(),
    });
    if (found.ok) {
      const rejected = rejectOldKartTrackClient(c.req.raw, found.snapshot);
      if (rejected) return rejected;
    }
    return jsonData({
      snapshot: found.ok ? lobbySnapshotSchema.parse(found.snapshot) : null,
    });
  });
  app.get("/api/admin/rooms/:gameId/media", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const cursor = c.req.query("cursor");
    if (
      cursor !== undefined &&
      (!/^[1-9]\d{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))
    )
      return failure(400, "Choose a valid media page.");
    if (
      !gameId.success ||
      !(await c.env.ROOM_CODE_REGISTRY.getByName("codes").hasGame(gameId.data))
    )
      return failure(404, "This room could not be found.");
    const credential = readCredentialCookie(c.req.header("cookie"), "control");
    if (!credential) return failure(401, "Open this room to renew its access.");
    const result = await c.env.PARTY_ROOM.getByName(gameId.data).adminMediaPage({
      ...credential,
      nowMs: Date.now(),
      ...(cursor ? { before: Number(cursor) } : {}),
    });
    return result.ok
      ? jsonData(result.page)
      : failure(401, "Open this room to renew its access.");
  });
  app.get("/api/admin/rooms/:gameId/media/:mediaId", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const mediaId = z.uuid().safeParse(c.req.param("mediaId"));
    if (!gameId.success || !mediaId.success)
      return failure(404, "This media is unavailable.");
    const credential = readCredentialCookie(c.req.header("cookie"), "control");
    if (!credential) return failure(401, "Open this room to renew its access.");
    const result = await c.env.PARTY_ROOM.getByName(gameId.data).readMedia({
      mediaId: mediaId.data,
      nowMs: Date.now(),
      credential: { ...credential, role: "control" },
    });
    if (!result.ok)
      return new Response(null, {
        status: result.error === "not_found" ? 404 : 401,
        headers: hiddenMediaHeaders(),
      });
    const bytes = await readAcceptedBytes(
      r2ObjectStore(c.env.MEDIA_BUCKET),
      result.finalKey,
    );
    if (!bytes)
      return new Response(null, { status: 404, headers: hiddenMediaHeaders() });
    return new Response(bytes, { headers: acceptedMediaHeaders(result.contentType) });
  });
  app.get("/api/admin/rooms/:gameId", async (c) => {
    const parsed = gameIdSchema.safeParse(c.req.param("gameId"));
    if (
      !parsed.success ||
      !(await c.env.ROOM_CODE_REGISTRY.getByName("codes").hasGame(parsed.data))
    )
      return failure(404, "This room could not be found.");
    const credential = readCredentialCookie(c.req.header("cookie"), "control");
    if (!credential) return failure(401, "Open this room to renew its access.");
    const found = await c.env.PARTY_ROOM.getByName(parsed.data).adminRoom({
      ...credential,
      now: new Date().toISOString(),
    });
    if (!found.ok) return failure(401, "Open this room to renew its access.");
    const headers = new Headers({ "set-cookie": selectedRoomCookie(parsed.data) });
    return (
      rejectOldKartTrackClient(c.req.raw, found.snapshot, headers) ??
      jsonData(lobbySnapshotSchema.parse(found.snapshot), 200, headers)
    );
  });
  app.post("/api/admin/rooms/:gameId/resume", async (c) => {
    const parsed = gameIdSchema.safeParse(c.req.param("gameId"));
    if (
      !parsed.success ||
      !(await c.env.ROOM_CODE_REGISTRY.getByName("codes").hasGame(parsed.data))
    )
      return failure(404, "This room could not be found.");
    const body: unknown = await c.req.json().catch(() => null);
    const requestId =
      body && typeof body === "object" && "requestId" in body
        ? body.requestId
        : undefined;
    if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{8,100}$/.test(requestId))
      return failure(400, "That opening request was not accepted.");
    const now = new Date().toISOString();
    const resumed = await c.env.PARTY_ROOM.getByName(parsed.data).resumeAdmin({
      requestId,
      now,
    });
    if (!resumed.ok)
      return failure(resumed.error === "not_found" ? 404 : 409, resumed.message);
    // Revoke only the credentials actually held by this browser, including old
    // sockets. Other operators' credentials and guest sessions are unaffected.
    await releasePreviousAdmin(c.req.raw, c.env, now, resumed);
    const headers = new Headers();
    for (const role of ["control", "presentation"] as const) {
      headers.append(
        "set-cookie",
        serializeCredentialCookie({
          role,
          ...resumed[role],
          maxAgeSeconds: Math.floor(credentialLifetimeMs(role) / 1000),
        }),
      );
    }
    headers.append("set-cookie", selectedRoomCookie(parsed.data));
    return (
      rejectOldKartTrackClient(c.req.raw, resumed.snapshot, headers) ??
      jsonData(lobbySnapshotSchema.parse(resumed.snapshot), 200, headers)
    );
  });
}

function failure(status: number, message: string) {
  return Response.json(
    {
      error:
        status === 401 ? "unauthenticated" : status === 404 ? "not_found" : "invalid",
      message,
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}
