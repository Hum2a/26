import {
  gameIdSchema,
  publicResultsSchema,
  resultsEmailSchema,
  liveConnectionNotFoundMessage,
  guestSessionSchema,
  joinCodeSchema,
  lobbyCreatedSchema,
  nicknameSchema,
  playCommandSchema,
  roomDiagnosticsSchema,
  roomClientErrorSchema,
  transferCodeSchema,
  transferIssuedSchema,
  trollKindSchema,
  type TrollKindName,
} from "@26/shared";
import { parseWallSettingsChange, type WallSettingsChange } from "../wall/moderation.ts";
import { acceptedKey } from "../media/keys.ts";
import { sampleWallPostCount, type SampleMedia } from "./sample.ts";

/** Pictures shipped with the app, used as sample wall photos. */
const samplePictures = [
  "/assets/questions/favourite-pokemon/mudkip.png",
  "/assets/questions/favourite-pokemon/tepig.png",
  "/assets/questions/favourite-pokemon/turtwig.png",
] as const;
import type { Hono } from "hono";
import { z } from "zod";
import { jsonData } from "../auth/http.ts";
import {
  readCredentialCookie,
  readGuestCookie,
  sameOriginReadRejection,
  sameOriginRejection,
  serializeCredentialCookie,
  serializeGuestCookie,
} from "../credentials/cookies.ts";
import { credentialLifetimeMs } from "../credentials/verify.ts";
import { authFailure } from "../auth/http.ts";
import { payloadDigest } from "./digest.ts";
import {
  adjustmentReasonMessage,
  wallSettingsMessage,
  controlMissingMessage,
  isLocalApp,
  roomMissingMessage,
} from "./limits.ts";
import { rejectUnlessRoomCreator } from "./access.ts";
import { selectedRoomCookie, releasePreviousAdmin } from "./admin-routes.ts";

export function registerRoomRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post("/api/rooms", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    const body = await readJson(c.req.raw);
    const requestId = readRequestId(body);
    if (!requestId) {
      return roomFailure(400, "invalid", "That request was not accepted.");
    }
    const created = await codes(c.env).createLobby({
      requestId,
      digest: await payloadDigest({ action: "create" }),
      now: new Date().toISOString(),
    });
    if (!created.ok) {
      return roomFailure(409, created.error, created.message);
    }
    const headers = new Headers();
    await releasePreviousAdmin(
      c.req.raw,
      c.env,
      new Date().toISOString(),
      created.result,
    );
    headers.append("set-cookie", selectedRoomCookie(created.result.gameId));
    headers.append(
      "set-cookie",
      serializeCredentialCookie({
        role: "control",
        credentialId: created.result.control.credentialId,
        secret: created.result.control.secret,
        maxAgeSeconds: Math.floor(credentialLifetimeMs("control") / 1000),
      }),
    );
    headers.append(
      "set-cookie",
      serializeCredentialCookie({
        role: "presentation",
        credentialId: created.result.presentation.credentialId,
        secret: created.result.presentation.secret,
        maxAgeSeconds: Math.floor(credentialLifetimeMs("presentation") / 1000),
      }),
    );
    return jsonData(
      lobbyCreatedSchema.parse({
        gameId: created.result.gameId,
        joinCode: created.result.joinCode,
        phase: created.result.phase,
        questionSetVersion: created.result.questionSetVersion,
        scoringVersion: created.result.scoringVersion,
        playerCount: created.result.playerCount,
      }),
      200,
      headers,
    );
  });

  app.post("/api/rooms/join", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const code = joinCodeSchema.safeParse(field(body, "code"));
    const nickname = nicknameSchema.safeParse(field(body, "nickname"));
    const requestId = readRequestId(body);
    if (!code.success || !nickname.success || !requestId) {
      return roomFailure(
        400,
        "invalid",
        "Enter the room code and a nickname of 1 to 24 characters.",
      );
    }
    const resolved = await codes(c.env).resolve(code.data);
    if (!resolved) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const joined = await room(c.env, resolved.gameId).joinPlayer({
      nickname: nickname.data,
      requestId,
      now: new Date().toISOString(),
    });
    if (!joined.ok) {
      return roomFailure(statusFor(joined.error), joined.error, joined.message);
    }
    return jsonData(
      guestSessionSchema.parse({
        gameId: joined.gameId,
        joinCode: joined.joinCode,
        playerId: joined.playerId,
        nickname: joined.nickname,
        stateVersion: joined.stateVersion,
      }),
      200,
      guestCookie(
        joined.gameId,
        joined.playerId,
        joined.secret,
        joined.expiresAt,
        c.env.APP_ENV !== "local",
      ),
    );
  });

  app.get("/api/rooms/session", async (c) => {
    const guest = readGuestCookie(c.req.header("cookie"));
    const gameId = gameIdSchema.safeParse(guest?.gameId);
    if (!guest || !gameId.success) {
      return roomFailure(401, "unauthenticated", "Join this room before continuing.");
    }
    const resumed = await room(c.env, gameId.data).resumeGuest({
      playerId: guest.playerId,
      secret: guest.secret,
      now: new Date().toISOString(),
    });
    if (!resumed.ok) {
      return roomFailure(
        resumed.error === "not_found" ? 404 : 401,
        resumed.error,
        resumed.message,
      );
    }
    return jsonData(resumed.session);
  });

  app.post("/api/rooms/lookup", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const code = joinCodeSchema.safeParse(field(body, "code"));
    if (!code.success) {
      return roomFailure(400, "invalid", "Enter the room code from the admin screen.");
    }
    const resolved = await codes(c.env).resolve(code.data);
    if (!resolved) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const presented = readCredentialCookie(c.req.header("cookie"), "presentation");
    if (!presented) {
      return roomFailure(401, "unauthenticated", "This screen needs its room session.");
    }
    const allowed = await room(c.env, resolved.gameId).verifyPresentation({
      credentialId: presented.credentialId,
      secret: presented.secret,
      now: new Date().toISOString(),
    });
    if (!allowed.ok) {
      return roomFailure(401, "unauthenticated", "This screen needs its room session.");
    }
    return jsonData(await room(c.env, resolved.gameId).snapshotFor("stage"));
  });

  app.post("/api/rooms/transfer", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    const body = await readJson(c.req.raw);
    const gameId = gameIdSchema.safeParse(field(body, "gameId"));
    const playerValue = field(body, "playerId");
    const playerId = typeof playerValue === "string" ? playerValue : "";
    const requestId = readRequestId(body);
    if (!gameId.success || !playerId || !requestId) {
      return roomFailure(400, "invalid", "Choose a player in this room.");
    }
    const issued = await room(c.env, gameId.data).issueTransfer({
      playerId,
      requestId,
      now: new Date().toISOString(),
    });
    if (!issued.ok) {
      return roomFailure(statusFor(issued.error), issued.error, issued.message);
    }
    return jsonData(
      transferIssuedSchema.parse({
        code: issued.code,
        expiresAt: issued.expiresAt,
        playerId: issued.playerId,
      }),
    );
  });

  app.post("/api/rooms/transfer/redeem", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const code = joinCodeSchema.safeParse(field(body, "joinCode"));
    const transfer = transferCodeSchema.safeParse(field(body, "code"));
    const requestId = readRequestId(body);
    if (!code.success || !transfer.success || !requestId) {
      return roomFailure(400, "invalid", "Enter the room code and the transfer code.");
    }
    const resolved = await codes(c.env).resolve(code.data);
    if (!resolved) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const redeemed = await room(c.env, resolved.gameId).redeemTransfer({
      code: transfer.data,
      requestId,
      now: new Date().toISOString(),
    });
    if (!redeemed.ok) {
      return roomFailure(statusFor(redeemed.error), redeemed.error, redeemed.message);
    }
    return jsonData(
      guestSessionSchema.parse({
        gameId: redeemed.gameId,
        joinCode: redeemed.joinCode,
        playerId: redeemed.playerId,
        nickname: redeemed.nickname,
        stateVersion: redeemed.stateVersion,
      }),
      200,
      guestCookie(
        redeemed.gameId,
        redeemed.playerId,
        redeemed.secret,
        redeemed.expiresAt,
        c.env.APP_ENV !== "local",
      ),
    );
  });

  app.post("/api/rooms/play", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const gameId = gameIdSchema.safeParse(field(body, "gameId"));
    const requestId = readRequestId(body);
    const action = field(body, "action");
    const commands = [
      "start",
      "start-kart-rehearsal",
      "pause",
      "resume",
      "advance",
      "skip",
      "finish",
      "reveal-names",
      "hide",
      "show",
      "rereveal",
      "rename",
      "swap",
      "kick",
      "recover",
      "adjust",
      "include",
      "exclude",
      "feature",
      "cancel-effect",
      "dismiss-cue",
      "troll-on",
      "troll-off",
      "wall-approve",
      "wall-decline",
      "wall-pull",
      "wall-skip",
      "wall-next",
      "wall-settings",
      "wall-mute",
      "wall-unmute",
      "hide-media",
      "retry-archive",
      "release-stuck-media",
      "retry-delivery",
    ] as const;
    if (
      !gameId.success ||
      !requestId ||
      typeof action !== "string" ||
      !commands.includes(action as (typeof commands)[number])
    ) {
      return roomFailure(400, "invalid", "That request was not accepted.");
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    const command = action as (typeof commands)[number];
    const details = readHostDetails(body, command);
    if (!details.ok) {
      return roomFailure(400, "invalid", details.message);
    }
    const input = {
      credentialId: control.credentialId,
      secret: control.secret,
      requestId,
      nowMs: Date.now(),
    };
    const target = room(c.env, gameId.data);
    const result =
      command === "start-kart-rehearsal"
        ? await target.startKartRehearsal(input)
        : command === "start"
          ? await target.startDemo(input)
          : command === "pause"
            ? await target.pauseRound(input)
            : command === "resume"
              ? await target.resumeRound(input)
              : command === "advance"
                ? await target.advanceRound(input)
                : command === "skip"
                  ? await target.skipRound(input)
                  : command === "finish"
                    ? await target.finishRound(input)
                    : await target.hostAction({
                        ...input,
                        action: command,
                        ...details.fields,
                      });
    if (!result.ok) {
      const status = result.error === "invalid" ? 400 : 401;
      return roomFailure(status, result.error, result.message);
    }
    return jsonData(playCommandSchema.parse(result));
  });

  app.post("/api/rooms/demo-cloud", async (c) => {
    if (!isLocalApp(c.env.APP_ENV)) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const gameId = gameIdSchema.safeParse(field(body, "gameId"));
    const requestId = readRequestId(body);
    if (!gameId.success || !requestId) {
      return roomFailure(400, "invalid", "That request was not accepted.");
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    const seeded = await room(c.env, gameId.data).seedDemoCloud({
      credentialId: control.credentialId,
      secret: control.secret,
      nowMs: Date.now(),
      target: 75,
    });
    if (!seeded.ok) {
      const status = seeded.error === "invalid" ? 400 : 401;
      return roomFailure(status, seeded.error, seeded.message);
    }
    return Response.json(
      { count: seeded.count },
      { headers: { "cache-control": "no-store" } },
    );
  });

  /**
   * Fills an empty room with sample data so the admin pages can be previewed.
   * Works in every environment, but only on a room with no players.
   */
  app.post("/api/rooms/sample", async (c) => {
    const rejected = await rejectUnlessRoomCreator(c.req.raw, c.env);
    if (rejected) {
      return rejected;
    }
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const body = await readJson(c.req.raw);
    const gameId = gameIdSchema.safeParse(field(body, "gameId"));
    if (!gameId.success) {
      return roomFailure(400, "invalid", "That request was not accepted.");
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    // Pictures already shipped with the app stand in for guest photos.
    const pictures = await Promise.all(
      samplePictures.map(async (path) => {
        const response = await c.env.ASSETS.fetch(new URL(path, c.req.url));
        if (!response.ok) {
          throw new Error(`Missing sample picture ${path}.`);
        }
        return {
          bytes: await response.arrayBuffer(),
          contentType: response.headers.get("content-type") ?? "image/png",
        };
      }),
    );
    const media: SampleMedia[] = [];
    for (let index = 0; index < sampleWallPostCount; index += 1) {
      const picture = pictures[index % pictures.length]!;
      const mediaId = crypto.randomUUID();
      const finalKey = acceptedKey(gameId.data, mediaId);
      await c.env.MEDIA_BUCKET.put(finalKey, picture.bytes, {
        httpMetadata: { contentType: picture.contentType },
      });
      media.push({
        mediaId,
        finalKey,
        contentType: picture.contentType,
        byteLength: picture.bytes.byteLength,
      });
    }
    const seeded = await room(c.env, gameId.data).seedSample({
      credentialId: control.credentialId,
      secret: control.secret,
      nowMs: Date.now(),
      media,
    });
    if (!seeded.ok) {
      // Nothing was stored in the room, so the copied pictures go too.
      await Promise.all(media.map((item) => c.env.MEDIA_BUCKET.delete(item.finalKey)));
      const status = seeded.error === "invalid" ? 400 : 401;
      return roomFailure(status, seeded.error, seeded.message);
    }
    return Response.json({ count: seeded.count }, { headers: { "cache-control": "no-store" } });
  });

  app.get("/api/rooms/:gameId/diagnostics", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    if (sameOriginReadRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    const result = await room(c.env, gameId.data).diagnostics({
      credentialId: control.credentialId,
      secret: control.secret,
      nowMs: Date.now(),
    });
    if (!result.ok) {
      const status = result.error === "invalid" ? 400 : 401;
      return roomFailure(status, result.error, result.message);
    }
    return jsonData(roomDiagnosticsSchema.parse(result.report));
  });

  app.get("/api/rooms/:gameId/summary", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    if (sameOriginReadRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    const result = await room(c.env, gameId.data).scoreSummary({
      credentialId: control.credentialId,
      secret: control.secret,
      nowMs: Date.now(),
    });
    if (!result.ok) {
      const status = result.error === "invalid" ? 400 : 401;
      return roomFailure(status, result.error, result.message);
    }
    return new Response(result.markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  });

  app.get("/api/rooms/:gameId/results", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const known = await codes(c.env).hasGame(gameId.data);
    if (!known) {
      return jsonData(publicResultsSchema.parse({ state: "unknown" }));
    }
    try {
      const status = await room(c.env, gameId.data).publishedResults();
      return jsonData(publicResultsSchema.parse(status));
    } catch {
      return jsonData(publicResultsSchema.parse({ state: "unknown" }));
    }
  });

  app.get("/api/rooms/:gameId/results/mine", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const token = new URL(c.req.url).searchParams.get("token");
    const target = room(c.env, gameId.data);
    if (token) {
      const granted = await target.grantResults(token, Date.now());
      if (!granted.ok) {
        const status = granted.error === "expired" ? 410 : 404;
        return roomFailure(
          status,
          granted.error === "expired" ? "expired" : "not_found",
          granted.message,
        );
      }
      return jsonData(granted.result);
    }
    const guest = readGuestCookie(c.req.header("cookie"));
    if (!guest || guest.gameId.toUpperCase() !== gameId.data.toUpperCase()) {
      return roomFailure(401, "unauthenticated", "Join this room before continuing.");
    }
    const own = await target.ownResults(guest.playerId, guest.secret, Date.now());
    if (!own.ok) {
      return roomFailure(
        own.error === "not_found" ? 404 : own.error === "forbidden" ? 403 : 401,
        own.error,
        own.message,
      );
    }
    return jsonData(own.result);
  });

  app.post("/api/rooms/:gameId/results/email", async (c) => {
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
    const email =
      typeof field(body, "email") === "string" ? String(field(body, "email")) : "";
    const result = await room(c.env, gameId.data).requestOwnEmail({
      playerId: guest.playerId,
      secret: guest.secret,
      email,
      nowMs: Date.now(),
      origin: resultsOrigin(c.req.url, c.env.BETTER_AUTH_URL),
    });
    if (!result.ok) {
      const status =
        result.error === "invalid" ? 400 : result.error === "not_found" ? 404 : 401;
      return roomFailure(status, result.error, result.message);
    }
    return jsonData(resultsEmailSchema.parse({ status: result.status }));
  });

  app.post("/api/rooms/:gameId/results/verify", async (c) => {
    if (sameOriginRejection(c.req.raw)) {
      return authFailure("forbidden", 403);
    }
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const body = await readJson(c.req.raw);
    const token =
      typeof field(body, "token") === "string" ? String(field(body, "token")) : "";
    const result = await room(c.env, gameId.data).confirmOwnEmail({
      token,
      nowMs: Date.now(),
      origin: resultsOrigin(c.req.url, c.env.BETTER_AUTH_URL),
    });
    return jsonData(resultsEmailSchema.parse({ status: result.status }));
  });

  app.get("/api/rooms/:gameId/results/outbox", async (c) => {
    if (c.env.APP_ENV !== "local") {
      return roomFailure(404, "not_found", roomMissingMessage);
    }
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    const control = readCredentialCookie(c.req.header("cookie"), "control");
    if (!gameId.success || !control) {
      return roomFailure(401, "unauthenticated", controlMissingMessage);
    }
    const listed = await room(c.env, gameId.data).listLocalOutbox({
      credentialId: control.credentialId,
      secret: control.secret,
      nowMs: Date.now(),
    });
    if (!listed.ok) {
      return roomFailure(
        listed.error === "not_found" ? 404 : 401,
        listed.error,
        listed.message,
      );
    }
    return jsonData({ messages: listed.messages });
  });

  app.get("/ws/:gameId", async (c) => {
    const gameId = gameIdSchema.safeParse(c.req.param("gameId"));
    if (!gameId.success) {
      return roomFailure(404, "not_found", liveConnectionNotFoundMessage);
    }
    return room(c.env, gameId.data).fetch(c.req.raw);
  });
}

function resultsOrigin(requestUrl: string, configured: string | undefined): string {
  const value = configured?.trim();
  if (value) {
    try {
      return new URL(value).origin;
    } catch {
      return new URL(requestUrl).origin;
    }
  }
  return new URL(requestUrl).origin;
}

function codes(env: Env) {
  return env.ROOM_CODE_REGISTRY.getByName("codes");
}

function room(env: Env, gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId.toUpperCase()));
}

function guestCookie(
  gameId: string,
  playerId: string,
  secret: string,
  expiresAt: string,
  secure: boolean,
): Headers {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    serializeGuestCookie({
      gameId,
      playerId,
      secret,
      maxAgeSeconds: Math.max(
        0,
        Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
      ),
      secure,
    }),
  );
  return headers;
}

function statusFor(error: string): number {
  if (error === "not_found") {
    return 404;
  }
  if (error === "expired") {
    return 401;
  }
  if (error === "conflict" || error === "full" || error === "digest_mismatch") {
    return 409;
  }
  return 400;
}

export function roomFailure(status: number, error: string, message: string): Response {
  const parsed = roomClientErrorSchema.safeParse({ error, message });
  if (!parsed.success) {
    return authFailure("invalid", 400);
  }
  return Response.json(parsed.data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function readHostDetails(
  body: unknown,
  action: string,
):
  | {
      ok: true;
      fields: {
        playerId?: string;
        otherPlayerId?: string;
        nickname?: string;
        points?: number;
        reason?: string;
        candidateId?: string;
        effectId?: string;
        mediaId?: string;
        trollKind?: TrollKindName;
        postId?: string;
        wallSettings?: WallSettingsChange;
      };
    }
  | { ok: false; message: string } {
  const needsPlayer = [
    "rename",
    "swap",
    "kick",
    "recover",
    "adjust",
    "include",
    "exclude",
    "wall-mute",
    "wall-unmute",
  ].includes(action);
  const playerId = z.uuid().safeParse(field(body, "playerId"));
  if (needsPlayer && !playerId.success) {
    return { ok: false, message: "Choose a player in this room." };
  }
  const fields: {
    playerId?: string;
    otherPlayerId?: string;
    nickname?: string;
    points?: number;
    reason?: string;
    candidateId?: string;
    effectId?: string;
    mediaId?: string;
    trollKind?: TrollKindName;
    postId?: string;
    wallSettings?: WallSettingsChange;
  } = {};
  if (playerId.success) {
    fields.playerId = playerId.data;
  }
  if (action === "rename") {
    const nickname = nicknameSchema.safeParse(field(body, "nickname"));
    if (!nickname.success) {
      return { ok: false, message: "Enter a nickname of 1 to 24 characters." };
    }
    fields.nickname = nickname.data;
  }
  if (action === "swap") {
    const otherPlayerId = z.uuid().safeParse(field(body, "otherPlayerId"));
    if (!otherPlayerId.success) {
      return { ok: false, message: "Choose a player in this room." };
    }
    fields.otherPlayerId = otherPlayerId.data;
  }
  if (action === "feature") {
    const candidateId = z
      .string()
      .regex(/^[A-Za-z0-9-]{1,36}$/)
      .safeParse(field(body, "candidateId"));
    if (!candidateId.success) {
      return { ok: false, message: "Choose an answer on this ballot." };
    }
    fields.candidateId = candidateId.data;
  }
  if (action === "hide-media") {
    const mediaId = z.uuid().safeParse(field(body, "mediaId"));
    if (!mediaId.success) {
      return { ok: false, message: "Choose a photo or voice clip that was kept." };
    }
    fields.mediaId = mediaId.data;
  }
  if (action === "wall-approve" || action === "wall-decline" || action === "wall-pull") {
    const postId = z.uuid().safeParse(field(body, "postId"));
    if (!postId.success) {
      return { ok: false, message: "Choose a photo on the wall." };
    }
    fields.postId = postId.data;
  }
  if (action === "wall-settings") {
    const change = parseWallSettingsChange(field(body, "wallSettings"));
    if (!change) {
      return { ok: false, message: wallSettingsMessage };
    }
    fields.wallSettings = change;
  }
  if (action === "troll-on" || action === "troll-off") {
    const trollKind = trollKindSchema.safeParse(field(body, "trollKind"));
    if (!trollKind.success) {
      return { ok: false, message: "Choose a troll from the catalogue." };
    }
    fields.trollKind = trollKind.data;
  }
  if (action === "cancel-effect") {
    const effectId = z.uuid().safeParse(field(body, "effectId"));
    if (!effectId.success) {
      return { ok: false, message: "Choose a troll that is still running." };
    }
    fields.effectId = effectId.data;
  }
  if (action === "adjust") {
    const points = z
      .number()
      .int()
      .min(-1000)
      .max(1000)
      .safeParse(field(body, "points"));
    const reason = z.string().trim().min(3).max(80).safeParse(field(body, "reason"));
    if (!points.success || points.data === 0 || !reason.success) {
      return { ok: false, message: adjustmentReasonMessage };
    }
    fields.points = points.data;
    fields.reason = reason.data;
  }
  return { ok: true, fields };
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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
