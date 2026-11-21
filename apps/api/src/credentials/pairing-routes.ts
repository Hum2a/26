import {
  gameIdSchema,
  joinCodeSchema,
  playCommandSchema,
  projectorPairingIssuedSchema,
  projectorPairedSchema,
  roomClientErrorSchema,
} from "@26/shared";
import type { Hono } from "hono";
import { authFailure, jsonData } from "../auth/http.ts";
import { rejectUnlessRoomCreator } from "../room/access.ts";
import { roomMissingMessage } from "../room/limits.ts";
// The room routes' reader stops at a byte limit while streaming.
import { readJson } from "../room/routes.ts";
import {
  readCredentialCookie,
  sameOriginRejection,
  serializeCredentialCookie,
} from "./cookies.ts";
import { normalisePairingCode } from "./pairing.ts";

/**
 * Projector pairing routes. Issuing needs the admin session and this room's
 * control credential. Redeeming needs only the code, which grants the
 * presentation role for that one room.
 */
export function registerRoomPairingRoutes(app: Hono<{ Bindings: Env }>): void {
  registerPairing(app, "projector", "stage", "presentation");
  registerPairing(app, "presenter", "presenter", "presenter");

  app.post("/api/presenter/:gameId/advance", async (c) => {
    if (sameOriginRejection(c.req.raw)) return authFailure("forbidden", 403);
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const body = await readJson(c.req.raw);
    const requestId = readRequestId(body);
    const generation = field(body, "expectedPhaseGeneration");
    if (
      !gameId.success ||
      !requestId ||
      typeof generation !== "number" ||
      !Number.isSafeInteger(generation) ||
      generation <= 0
    )
      return failure(400, "invalid", "Choose the current cue before continuing.");
    const credential = readCredentialCookie(c.req.header("cookie"), "presenter");
    if (!credential)
      return failure(
        401,
        "unauthenticated",
        "Pair this phone to use presenter controls.",
      );
    const result = await c.env.PARTY_ROOM.getByName(gameId.data).advanceRound({
      ...credential,
      presenter: true,
      requestId,
      expectedPhaseGeneration: generation,
      nowMs: Date.now(),
    });
    if (!result.ok)
      return failure(statusFor(result.error), result.error, result.message);
    return jsonData(playCommandSchema.parse(result));
  });
}

function registerPairing(
  app: Hono<{ Bindings: Env }>,
  kind: "projector" | "presenter",
  surface: "stage" | "presenter",
  role: "presentation" | "presenter",
): void {
  app.post(`/api/admin/rooms/:gameId/${kind}-pairing`, async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) return rejected;
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const requestId = readRequestId(await readJson(c.req.raw));
    if (!gameId.success || !requestId) {
      return failure(400, "invalid", "That request was not accepted.");
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return failure(401, "unauthenticated", "Open this room to renew its access.");
    }
    const issued = await c.env.PARTY_ROOM.getByName(gameId.data).issueProjectorPairing({
      ...control,
      requestId,
      nowMs: Date.now(),
      role,
    });
    if (!issued.ok)
      return failure(statusFor(issued.error), issued.error, issued.message);
    return jsonData(
      projectorPairingIssuedSchema.parse({
        code: issued.code,
        expiresAt: issued.expiresAt,
      }),
    );
  });

  app.post(`/api/${surface}/pair`, async (c) => {
    if (sameOriginRejection(c.req.raw)) return authFailure("forbidden", 403);
    const body = await readJson(c.req.raw);
    const joinCode = joinCodeSchema.safeParse(
      typeof field(body, "joinCode") === "string"
        ? String(field(body, "joinCode")).trim().toUpperCase()
        : undefined,
    );
    const code = normalisePairingCode(field(body, "code"));
    const requestId = readRequestId(body);
    if (!joinCode.success || !code || !requestId) {
      return failure(
        400,
        "invalid",
        "Enter the six-character join code and the eight-character pairing code.",
      );
    }
    const resolved = await c.env.ROOM_CODE_REGISTRY.getByName("codes").resolve(
      joinCode.data,
    );
    if (!resolved) return failure(404, "not_found", roomMissingMessage);
    const paired = await c.env.PARTY_ROOM.getByName(
      resolved.gameId,
    ).redeemProjectorPairing({ code, requestId, nowMs: Date.now(), role });
    if (!paired.ok)
      return failure(statusFor(paired.error), paired.error, paired.message);
    const headers = new Headers();
    headers.append(
      "set-cookie",
      serializeCredentialCookie({
        role,
        credentialId: paired.presentation.credentialId,
        secret: paired.presentation.secret,
        maxAgeSeconds: Math.max(
          0,
          Math.floor((Date.parse(paired.presentation.expiresAt) - Date.now()) / 1000),
        ),
      }),
    );
    return jsonData(
      projectorPairedSchema.parse({
        gameId: paired.gameId,
        joinCode: paired.joinCode,
        expiresAt: paired.presentation.expiresAt,
      }),
      200,
      headers,
    );
  });
}

function statusFor(error: string): number {
  if (error === "rate_limited") return 429;
  if (error === "not_found") return 404;
  if (error === "unauthenticated" || error === "expired") return 401;
  if (error === "forbidden") return 403;
  if (error === "digest_mismatch" || error === "conflict") return 409;
  return 400;
}

function failure(status: number, error: string, message: string): Response {
  const parsed = roomClientErrorSchema.safeParse({
    // The shared error list has no rate-limit code; the 429 status carries it.
    error: error === "rate_limited" ? "conflict" : error,
    message,
  });
  if (!parsed.success) return authFailure("invalid", 400);
  return Response.json(parsed.data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function field(body: unknown, key: string): unknown {
  if (!body || typeof body !== "object" || !(key in body)) return undefined;
  return (body as Record<string, unknown>)[key];
}

function readRequestId(body: unknown): string | undefined {
  const value = field(body, "requestId");
  return typeof value === "string" && /^[0-9a-f-]{8,80}$/i.test(value)
    ? value
    : undefined;
}
