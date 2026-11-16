import { env, runInDurableObject } from "cloudflare:test";
import { encode } from "jpeg-js";
import { withClientApiQuery } from "./client-api-key.ts";
import { finaliseUpload, type MediaBook } from "../src/media/finalise.ts";
import { localJpegPhoto } from "../src/media/photo.ts";
import { memoryObjectStore } from "../src/media/store.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { readWallPosts } from "../src/wall/store.ts";

/** Shared setup for the photo wall room specs. */ export type Stub = ReturnType<
  typeof env.PARTY_ROOM.getByName
>;
export type Player = { gameId: string; playerId: string; secret: string };

export async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const join = async (nickname: string): Promise<Player> => {
    const joined = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    return joined;
  };
  /** Runs a host command with the room's control credential. */
  const host = (action: string, extra: Record<string, unknown> = {}) =>
    stub.hostAction({
      credentialId: created.result.control.credentialId,
      secret: created.result.control.secret,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action,
      ...extra,
    });
  return {
    gameId: created.result.gameId,
    stub,
    join,
    host,
    control: created.result.control,
    presentation: created.result.presentation,
  };
}

export async function upload(
  stub: Stub,
  player: Player,
  kind: "photo" | "voice" = "photo",
): Promise<{ ok: true; mediaId: string } | { ok: false; message: string }> {
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId: crypto.randomUUID(),
    kind,
    purpose: "wall",
    nowMs: Date.now(),
  });
  if (!reserved.ok) return { ok: false, message: reserved.message };
  const store = memoryObjectStore();
  await store.put(reserved.tempKey, tinyJpeg(), {
    contentType: "image/jpeg",
    ifNoneMatch: false,
  });
  const done = await finaliseUpload({
    book: book(stub, player),
    store,
    uploadId: reserved.uploadId,
    playerId: player.playerId,
    nowMs: Date.now(),
    photo: localJpegPhoto,
  });
  return done.ok
    ? { ok: true, mediaId: done.mediaId }
    : { ok: false, message: done.message };
}

export async function phone(stub: Stub, gameId: string, player: Player) {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: `26_guest=${player.gameId}.${player.playerId}.${player.secret}`,
      },
    }),
  );
  const socket = response.webSocket!;
  socket.accept();
  return {
    socket,
    send(command: Record<string, unknown>, requestId = crypto.randomUUID()) {
      return new Promise<{ accepted: boolean; error?: string }>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          const message = JSON.parse(String(event.data)) as {
            kind?: string;
            requestId?: string;
            accepted?: boolean;
            error?: string;
          };
          if (message.kind === "ack" && message.requestId === requestId) {
            socket.removeEventListener("message", onMessage);
            resolve({
              accepted: message.accepted === true,
              ...(message.error ? { error: message.error } : {}),
            });
          }
        };
        socket.addEventListener("message", onMessage);
        socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
      });
    },
  };
}

export async function posts(stub: Stub, playerId?: string) {
  return runInDurableObject(stub, (_instance, state) =>
    readWallPosts(state.storage.sql, playerId),
  );
}

export async function wallSettings(
  stub: Stub,
  input: { enabled?: number; moderation?: string; muted?: string[] },
) {
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      `INSERT INTO wall_setting (id, enabled, moderation, placement, show_ms, captions, muted_json)
       VALUES (1, ?, ?, 'breaks', 8000, 1, ?)
       ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled,
         moderation = excluded.moderation, muted_json = excluded.muted_json`,
      input.enabled ?? 1,
      input.moderation ?? "approve",
      JSON.stringify(input.muted ?? []),
    );
  });
}
export function tinyJpeg(): Uint8Array {
  const data = new Uint8Array(2 * 2 * 4);
  data[3] = 255;
  return encode({ data, width: 2, height: 2 }, 80).data;
}

export function book(stub: Stub, player: Player): MediaBook {
  return {
    claimUpload: (input) => stub.claimMedia({ ...input, secret: player.secret }),
    rememberSource: (uploadId, etag) => stub.rememberMediaSource(uploadId, etag),
    clearPrepared: (uploadId) => stub.clearMediaSource(uploadId),
    stageUpload: (input) => stub.stageMedia(input),
    commitUpload: (input) => stub.commitMedia(input),
    releaseUpload: (uploadId) => stub.releaseMedia(uploadId),
    rejectUpload: (uploadId, message) => stub.rejectMedia(uploadId, message),
  };
}
