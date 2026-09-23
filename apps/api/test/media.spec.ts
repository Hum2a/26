import { env } from "cloudflare:test";
import { encode } from "jpeg-js";
import { describe, expect, it } from "vitest";
import {
  finaliseUpload,
  readAcceptedBytes,
  type MediaBook,
  type MediaHandoff,
} from "../src/media/finalise.ts";
import { localJpegPhoto } from "../src/media/photo.ts";
import { memoryObjectStore, type ObjectStore } from "../src/media/store.ts";
import { validateWav } from "../src/media/wav.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  mediaChangedMessage,
  mediaLargeMessage,
  mediaExpiredMessage,
  mediaLateMessage,
  mediaLeaseMs,
  mediaUrlMs,
  mediaOwnerMessage,
  mediaQuotaMessage,
  mediaTypeMessage,
  mediaVoiceMessage,
  playerMediaSlots,
  temporaryPhotoBytes,
} from "../src/room/limits.ts";

const now = 10_000_000;

describe("media finalisation", () => {
  it("rejects an invalid photo, an oversized body, and another player's upload", async () => {
    const { stub, amina, bilal } = await playingRoom();
    const store = memoryObjectStore();
    const bad = await stub.reserveMedia({
      playerId: amina.playerId,
      secret: amina.secret,
      requestId: crypto.randomUUID(),
      kind: "photo",
      nowMs: now,
    });
    expect(bad.ok).toBe(true);
    if (!bad.ok) {
      return;
    }
    await store.put(bad.tempKey, new TextEncoder().encode("hello"), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    expect(await finish(stub, amina, bad.uploadId, store, now)).toMatchObject({
      ok: false,
      message: mediaTypeMessage,
    });
    expect([...store.objects.keys()].some((key) => key.startsWith("accepted/"))).toBe(
      false,
    );

    const huge = await stub.reserveMedia({
      playerId: amina.playerId,
      secret: amina.secret,
      requestId: crypto.randomUUID(),
      kind: "photo",
      nowMs: now,
    });
    expect(huge.ok).toBe(true);
    if (!huge.ok) {
      return;
    }
    await store.put(huge.tempKey, new Uint8Array(temporaryPhotoBytes + 1), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    expect(await finish(stub, amina, huge.uploadId, store, now)).toMatchObject({
      ok: false,
      message: mediaLargeMessage,
    });

    const photo = await stub.reserveMedia({
      playerId: amina.playerId,
      secret: amina.secret,
      requestId: crypto.randomUUID(),
      kind: "photo",
      nowMs: now,
    });
    expect(photo.ok).toBe(true);
    if (!photo.ok) {
      return;
    }
    expect(
      await stub.claimMedia({
        playerId: bilal.playerId,
        secret: bilal.secret,
        uploadId: photo.uploadId,
        nowMs: now,
      }),
    ).toMatchObject({ ok: false, message: mediaOwnerMessage });
    await store.put(photo.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const accepted = await finish(stub, amina, photo.uploadId, store, now);
    expect(accepted.ok).toBe(true);
  });

  it("keeps one accepted object when finalisation is repeated or the temporary object is replaced", async () => {
    const { stub, amina } = await playingRoom();
    const store = countingStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const first = await finish(stub, amina, slot.uploadId, store, now);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.mediaId).not.toBe(slot.uploadId);
    const kept = await readAcceptedBytes(store, acceptedKey(store));
    expect(store.acceptedPuts).toBe(1);
    await store.put(slot.tempKey, tinyJpeg(8, 8), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const second = await finish(stub, amina, slot.uploadId, store, now + 1);
    expect(second).toMatchObject({ ok: true, mediaId: first.mediaId, repeated: true });
    expect(store.acceptedPuts).toBe(1);
    expect(await readAcceptedBytes(store, acceptedKey(store))).toEqual(kept);
    expect(
      await store.put(acceptedKey(store), tinyJpeg(3, 3), {
        contentType: "image/jpeg",
        ifNoneMatch: true,
      }),
    ).toBeNull();
    expect(await readAcceptedBytes(store, acceptedKey(store))).toEqual(kept);
  });

  it("does not publish when the temporary object changes while it is being read", async () => {
    const { stub, amina } = await playingRoom();
    const store = flippingStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    store.arm();
    expect(await finish(stub, amina, slot.uploadId, store, now)).toMatchObject({
      ok: false,
      message: mediaChangedMessage,
    });
    expect([...store.objects.keys()].some((key) => key.startsWith("accepted/"))).toBe(
      false,
    );
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const retried = await finish(
      stub,
      amina,
      slot.uploadId,
      store,
      now + mediaLeaseMs + 1,
    );
    expect(retried.ok).toBe(true);
  });

  it("recovers a crash at each handoff and cancels when the question closes", async () => {
    const points: MediaHandoff[] = [
      "after-read",
      "after-source",
      "after-write",
      "after-commit",
    ];
    for (const point of points) {
      const { stub, amina } = await playingRoom();
      const store = countingStore();
      const slot = await reserve(stub, amina, "photo");
      await store.put(slot.tempKey, tinyJpeg(), {
        contentType: "image/jpeg",
        ifNoneMatch: false,
      });
      await expect(
        finish(stub, amina, slot.uploadId, store, now, (hit) => {
          if (hit === point) {
            throw new Error(`crash ${point}`);
          }
        }),
      ).rejects.toThrow(`crash ${point}`);
      const recovered = await finish(
        stub,
        amina,
        slot.uploadId,
        store,
        now + mediaLeaseMs + 1,
      );
      expect(recovered.ok).toBe(true);
      if (!recovered.ok) {
        return;
      }
      expect(store.acceptedPuts).toBe(1);
      expect(store.objects.has(slot.tempKey)).toBe(false);
    }

    const { stub, amina, created } = await playingRoom();
    const store = countingStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    await expect(
      finish(stub, amina, slot.uploadId, store, now, async (point) => {
        if (point === "after-stage") {
          const moved = await stub.skipRound({
            credentialId: created.control.credentialId,
            secret: created.control.secret,
            requestId: crypto.randomUUID(),
            nowMs: now,
          });
          if (!moved.ok) {
            throw new Error(moved.message);
          }
          throw new Error("crash after-stage");
        }
      }),
    ).rejects.toThrow("crash after-stage");
    expect(await finish(stub, amina, slot.uploadId, store, now + 1)).toMatchObject({
      ok: false,
      message: mediaLateMessage,
    });
    expect([...store.objects.keys()].some((key) => key.startsWith("accepted/"))).toBe(
      false,
    );
    expect((await stub.snapshotFor("stage")).media).toEqual([]);
  });

  it("hides accepted media from later reads and limits each player", async () => {
    const { stub, amina, created } = await playingRoom();
    const store = memoryObjectStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const accepted = await finish(stub, amina, slot.uploadId, store, now);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    expect((await stub.snapshotFor("stage")).media.map((item) => item.mediaId)).toEqual(
      [accepted.mediaId],
    );
    const hidden = await stub.hostAction({
      credentialId: created.control.credentialId,
      secret: created.control.secret,
      requestId: crypto.randomUUID(),
      nowMs: now,
      action: "hide-media",
      mediaId: accepted.mediaId,
    });
    expect(hidden.ok).toBe(true);
    expect((await stub.snapshotFor("stage")).media).toEqual([]);
    expect((await stub.snapshotFor("control")).media[0]?.hidden).toBe(true);
    expect(
      await stub.readMedia({
        mediaId: accepted.mediaId,
        nowMs: now,
        guest: { playerId: amina.playerId, secret: amina.secret },
      }),
    ).toMatchObject({ ok: false, error: "not_found" });
    const voice = await reserve(stub, amina, "voice");
    await store.put(voice.tempKey, wav(1), {
      contentType: "audio/wav",
      ifNoneMatch: false,
    });
    const spoken = await finish(stub, amina, voice.uploadId, store, now);
    expect(spoken.ok).toBe(true);
    const long = await reserve(stub, amina, "voice");
    await store.put(long.tempKey, wav(4), {
      contentType: "audio/wav",
      ifNoneMatch: false,
    });
    expect(await finish(stub, amina, long.uploadId, store, now)).toMatchObject({
      ok: false,
      message: mediaVoiceMessage,
    });
    expect(validateWav(wav(1)).ok).toBe(true);

    let blocked = false;
    for (let index = 0; index < playerMediaSlots + 2; index += 1) {
      const next = await stub.reserveMedia({
        playerId: amina.playerId,
        secret: amina.secret,
        requestId: crypto.randomUUID(),
        kind: "photo",
        nowMs: now,
      });
      if (!next.ok) {
        expect(next.message).toBe(mediaQuotaMessage);
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
    const replay = await stub.reserveMedia({
      playerId: amina.playerId,
      secret: amina.secret,
      requestId: voice.requestId,
      kind: "voice",
      nowMs: now,
    });
    expect(replay).toMatchObject({ ok: true, uploadId: voice.uploadId });
  });

  it("publishes one object when two finalisations run together", async () => {
    const { stub, amina } = await playingRoom();
    const store = countingStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const results = await Promise.all([
      finish(stub, amina, slot.uploadId, store, now),
      finish(stub, amina, slot.uploadId, store, now),
    ]);
    const published = results.filter((result) => result.ok);
    expect(published.length).toBeGreaterThan(0);
    expect(new Set(published.map((result) => result.mediaId)).size).toBe(1);
    expect(
      [...store.objects.keys()].filter((key) => key.startsWith("accepted/")),
    ).toHaveLength(1);
    expect(store.acceptedPuts).toBe(1);
  });

  it("removes a temporary object when the upload window has expired", async () => {
    const { stub, amina } = await playingRoom();
    const store = memoryObjectStore();
    const slot = await reserve(stub, amina, "photo");
    await store.put(slot.tempKey, tinyJpeg(), {
      contentType: "image/jpeg",
      ifNoneMatch: false,
    });
    const expired = await finish(
      stub,
      amina,
      slot.uploadId,
      store,
      now + mediaUrlMs + 1,
    );
    expect(expired).toMatchObject({ ok: false, message: mediaExpiredMessage });
    expect(store.objects.has(slot.tempKey)).toBe(false);
    expect([...store.objects.keys()].some((key) => key.startsWith("accepted/"))).toBe(
      false,
    );
  });
});

function tinyJpeg(width = 2, height = 2): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  data[3] = 255;
  return encode({ data, width, height }, 80).data;
}

function wav(seconds: number): Uint8Array {
  const sampleRate = 8_000;
  const sampleBytes = sampleRate * seconds * 2;
  const bytes = new Uint8Array(44 + sampleBytes);
  const view = new DataView(bytes.buffer);
  write(bytes, 0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  write(bytes, 8, "WAVE");
  write(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(bytes, 36, "data");
  view.setUint32(40, sampleBytes, true);
  return bytes;
}

function write(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function countingStore() {
  const store = memoryObjectStore();
  let acceptedPuts = 0;
  const wrapped: ObjectStore & { acceptedPuts: number; objects: typeof store.objects } =
    {
      objects: store.objects,
      get acceptedPuts() {
        return acceptedPuts;
      },
      head: (key) => store.head(key),
      get: (key, options) => store.get(key, options),
      async put(key, bytes, options) {
        if (key.startsWith("accepted/")) {
          acceptedPuts += 1;
        }
        return store.put(key, bytes, options);
      },
      delete: (key) => store.delete(key),
    };
  return wrapped;
}

function flippingStore() {
  const store = memoryObjectStore();
  let armed = false;
  return {
    objects: store.objects,
    arm() {
      armed = true;
    },
    head: (key: string) => store.head(key),
    async get(key: string, options: { etagMatches: string; maxBytes: number }) {
      if (armed) {
        armed = false;
        const current = store.objects.get(key);
        if (current) {
          const next = new Uint8Array(current.bytes);
          next[0] = current.bytes[0] === 9 ? 8 : 9;
          await store.put(key, next, { contentType: "image/jpeg", ifNoneMatch: false });
        }
      }
      return store.get(key, options);
    },
    put: (
      key: string,
      bytes: Uint8Array,
      options: { contentType: string; ifNoneMatch: boolean },
    ) => store.put(key, bytes, options),
    delete: (key: string) => store.delete(key),
  };
}

function acceptedKey(store: { objects: Map<string, unknown> }): string {
  const key = [...store.objects.keys()].find((item) => item.startsWith("accepted/"));
  if (!key) {
    throw new Error("The accepted object is missing.");
  }
  return key;
}

async function reserve(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string },
  kind: "photo" | "voice",
) {
  const requestId = crypto.randomUUID();
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId,
    kind,
    nowMs: now,
  });
  if (!reserved.ok) {
    throw new Error(reserved.message);
  }
  return { ...reserved, requestId };
}

async function finish(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string },
  uploadId: string,
  store: ObjectStore,
  at: number,
  interrupt?: (point: MediaHandoff) => void | Promise<void>,
) {
  return finaliseUpload({
    book: book(stub, player),
    store,
    uploadId,
    playerId: player.playerId,
    nowMs: at,
    photo: localJpegPhoto,
    interrupt,
  });
}

function book(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string },
): MediaBook {
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

async function playingRoom() {
  const created = await createRoom();
  const stub = room(created.gameId);
  const amina = await join(stub, "Amina");
  const bilal = await join(stub, "Bilal");
  const started = await stub.startDemo({
    credentialId: created.control.credentialId,
    secret: created.control.secret,
    requestId: crypto.randomUUID(),
    nowMs: now,
  });
  if (!started.ok) {
    throw new Error(started.message);
  }
  return { created, stub, amina, bilal };
}

async function join(stub: ReturnType<typeof room>, nickname: string) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date(now).toISOString(),
  });
  if (!joined.ok) {
    throw new Error(joined.message);
  }
  return joined;
}

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return created.result;
}

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}
