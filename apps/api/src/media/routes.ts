import { gameIdSchema, mediaFinalSchema, mediaSlotSchema } from "@26/shared";
import type { Hono } from "hono";
import { z } from "zod";
import { authFailure } from "../auth/http.ts";
import { jsonData } from "../auth/http.ts";
import {
  readCredentialCookie,
  readGuestCookie,
  sameOriginRejection,
} from "../credentials/cookies.ts";
import {
  acceptedMediaHeaders,
  finaliseUpload,
  galleryMediaHeaders,
  hiddenMediaHeaders,
  readAcceptedBytes,
} from "./finalise.ts";
import { createPhotoProcessor } from "./photo.ts";
import { uploadTarget } from "./presign.ts";
import { r2ObjectStore } from "./store.ts";
import {
  mediaLargeMessage,
  mediaMissingMessage,
  mediaTypeMessage,
  temporaryPhotoBytes,
  voiceMaxBytes,
} from "../room/limits.ts";
import { roomFailure } from "../room/routes.ts";

export function registerMediaRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post("/api/rooms/:gameId/media/slots", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const guest = readGuestCookie(c.req.header("cookie"));
    if (
      !gameId.success ||
      !guest ||
      guest.gameId.toUpperCase() !== gameId.data.toUpperCase()
    ) {
      return roomFailure(401, "unauthenticated", "Join this room before continuing.");
    }
    const body = await readJson(c.req.raw);
    const requestId = readRequestId(body);
    const kind = z.enum(["photo", "voice"]).safeParse(field(body, "kind"));
    if (!requestId || !kind.success) {
      return roomFailure(400, "invalid", "That request was not accepted.");
    }
    const target = room(c.env, gameId.data);
    const reserved = await target.reserveMedia({
      playerId: guest.playerId,
      secret: guest.secret,
      requestId,
      kind: kind.data,
      nowMs: Date.now(),
    });
    if (!reserved.ok) {
      return roomFailure(statusFor(reserved.error), reserved.error, reserved.message);
    }
    const upload = await uploadTarget({
      env: c.env,
      requestUrl: c.req.url,
      gameId: gameId.data,
      uploadId: reserved.uploadId,
      tempKey: reserved.tempKey,
      contentType: reserved.contentType,
    });
    if (!upload.ok) {
      return roomFailure(503, "invalid", upload.message);
    }
    return jsonData(
      mediaSlotSchema.parse({
        uploadId: reserved.uploadId,
        expiresAt: reserved.expiresAt,
        uploadUrl: upload.uploadUrl,
        contentType: reserved.contentType,
      }),
    );
  });

  app.put("/api/rooms/:gameId/media/temporary/:uploadId", async (c) => {
    if (c.env.APP_ENV !== "local") {
      return roomFailure(404, "not_found", mediaMissingMessage);
    }
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const uploadId = z.uuid().safeParse(c.req.param("uploadId"));
    const guest = readGuestCookie(c.req.header("cookie"));
    if (
      !gameId.success ||
      !uploadId.success ||
      !guest ||
      guest.gameId.toUpperCase() !== gameId.data.toUpperCase()
    ) {
      return roomFailure(401, "unauthenticated", "Join this room before continuing.");
    }
    const prepared = await room(c.env, gameId.data).prepareMediaWrite({
      playerId: guest.playerId,
      secret: guest.secret,
      uploadId: uploadId.data,
      nowMs: Date.now(),
    });
    if (!prepared.ok) {
      return roomFailure(statusFor(prepared.error), prepared.error, prepared.message);
    }
    const contentType = c.req.header("content-type")?.split(";")[0]?.trim();
    if (contentType !== prepared.contentType) {
      return roomFailure(400, "invalid", mediaTypeMessage);
    }
    const limit =
      prepared.contentType === "audio/wav" ? voiceMaxBytes : temporaryPhotoBytes;
    const body = await readBounded(c.req.raw, limit);
    if (body === "too-large") {
      return roomFailure(413, "invalid", mediaLargeMessage);
    }
    await r2ObjectStore(c.env.MEDIA_BUCKET).put(prepared.tempKey, body, {
      contentType: prepared.contentType,
      ifNoneMatch: false,
    });
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  });

  app.post("/api/rooms/:gameId/media/:uploadId/finalise", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const uploadId = z.uuid().safeParse(c.req.param("uploadId"));
    const guest = readGuestCookie(c.req.header("cookie"));
    if (
      !gameId.success ||
      !uploadId.success ||
      !guest ||
      guest.gameId.toUpperCase() !== gameId.data.toUpperCase()
    ) {
      return roomFailure(401, "unauthenticated", "Join this room before continuing.");
    }
    const target = room(c.env, gameId.data);
    const secret = guest.secret;
    const playerId = guest.playerId;
    const result = await finaliseUpload({
      book: {
        claimUpload: (input) => target.claimMedia({ ...input, secret }),
        rememberSource: (id, etag) => target.rememberMediaSource(id, etag),
        clearPrepared: (id) => target.clearMediaSource(id),
        stageUpload: (input) => target.stageMedia(input),
        commitUpload: (input) => target.commitMedia(input),
        releaseUpload: (id) => target.releaseMedia(id),
        rejectUpload: (id, message) => target.rejectMedia(id, message),
      },
      store: r2ObjectStore(c.env.MEDIA_BUCKET),
      uploadId: uploadId.data,
      playerId,
      nowMs: Date.now(),
      photo: createPhotoProcessor(c.env),
    });
    if (!result.ok) {
      return roomFailure(statusFor(result.error), result.error, result.message);
    }
    return jsonData(mediaFinalSchema.parse(result));
  });

  app.get("/api/rooms/:gameId/media/:mediaId", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const mediaId = z.uuid().safeParse(c.req.param("mediaId"));
    if (!gameId.success || !mediaId.success) {
      return roomFailure(404, "not_found", mediaMissingMessage);
    }
    const guest = readGuestCookie(c.req.header("cookie"));
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    const presentation = readCredentialCookie(c.req.header("cookie"), "presentation");
    const target = room(c.env, gameId.data);
    const allowed = await target.readMedia({
      mediaId: mediaId.data,
      nowMs: Date.now(),
      ...(guest && guest.gameId.toUpperCase() === gameId.data.toUpperCase()
        ? { guest: { playerId: guest.playerId, secret: guest.secret } }
        : control
          ? { credential: { ...control, role: "control" as const } }
          : presentation
            ? { credential: { ...presentation, role: "presentation" as const } }
            : {}),
    });
    if (!allowed.ok) {
      return roomFailure(
        allowed.error === "not_found" ? 404 : statusFor(allowed.error),
        allowed.error,
        allowed.message,
      );
    }
    const bytes = await readAcceptedBytes(
      r2ObjectStore(c.env.MEDIA_BUCKET),
      allowed.finalKey,
    );
    if (!bytes) {
      return roomFailure(404, "not_found", mediaMissingMessage);
    }
    const headers = acceptedMediaHeaders(allowed.contentType);
    return new Response(bytes, { status: 200, headers });
  });

  app.get("/api/rooms/:gameId/gallery/:mediaId", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const mediaId = z.uuid().safeParse(c.req.param("mediaId"));
    if (!gameId.success || !mediaId.success) {
      return new Response(null, { status: 404, headers: hiddenMediaHeaders() });
    }
    const target = room(c.env, gameId.data);
    const published = await target.publishedResults();
    const listed =
      published.gallery?.some((item) => item.mediaId === mediaId.data) ?? false;
    const live = await target.readGalleryMedia(mediaId.data);
    if (!listed || !live.ok) {
      return new Response(null, { status: 404, headers: hiddenMediaHeaders() });
    }
    const bytes = await readAcceptedBytes(
      r2ObjectStore(c.env.MEDIA_BUCKET),
      live.finalKey,
    );
    if (!bytes) {
      return new Response(null, { status: 404, headers: hiddenMediaHeaders() });
    }
    return new Response(bytes, {
      status: 200,
      headers: galleryMediaHeaders(live.contentType),
    });
  });
}

function room(env: Env, gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId.toUpperCase()));
}

function statusFor(error: string): number {
  if (error === "unauthenticated") {
    return 401;
  }
  if (error === "forbidden") {
    return 403;
  }
  if (error === "not_found") {
    return 404;
  }
  if (error === "full") {
    return 409;
  }
  if (error === "expired") {
    return 410;
  }
  if (error === "conflict") {
    return 409;
  }
  return 400;
}

async function readBounded(
  request: Request,
  max: number,
): Promise<Uint8Array | "too-large"> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    return "too-large";
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    total += next.value.byteLength;
    if (total > max) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(next.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function field(body: unknown, key: string): unknown {
  if (!body || typeof body !== "object" || !(key in body)) {
    return undefined;
  }
  return (body as Record<string, unknown>)[key];
}

function readRequestId(body: unknown): string | undefined {
  const value = field(body, "requestId");
  if (typeof value !== "string" || !/^[0-9a-f-]{8,80}$/i.test(value)) {
    return undefined;
  }
  return value;
}
