import { env, runInDurableObject, evictDurableObject } from "cloudflare:test";
import { decode, encode } from "jpeg-js";
import { expect, it } from "vitest";
import { apiFetch } from "./api-fetch.ts";
import { payloadDigest } from "../src/room/digest.ts";

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  const stub = env.PARTY_ROOM.getByName(room.gameId);
  const joined = await stub.joinPlayer({
    nickname: "Amina",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  return {
    room,
    stub,
    joined,
    credential: {
      credentialId: room.control.credentialId,
      secret: room.control.secret,
    },
  };
}

it.each(["photo-bias-on", "photo-bias-off"])(
  "persists %s, refuses unauthorised commands and replays after eviction",
  async (action) => {
    const { stub, credential, joined } = await setup();
    const command = {
      ...credential,
      action,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    };
    expect((await stub.hostAction({ ...command, secret: "incorrect" })).ok).toBe(false);
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    const host = await stub.snapshotFor("control");
    expect(host.photoBias?.enabled).toBe(action === "photo-bias-on");
    expect(host.photoBias?.history).toHaveLength(1);
    expect(host.mediaDisplayRevision).toBe(1);
    for (const audience of ["stage", "guest"] as const) {
      const view = await stub.snapshotFor(
        audience,
        audience === "guest" ? joined.playerId : undefined,
      );
      expect(view.photoBias).toBeUndefined();
      expect(JSON.stringify(view)).not.toContain("iphonePhotos");
      expect(view.mediaDisplayRevision).toBe(1);
    }
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    expect((await stub.snapshotFor("control")).photoBias?.history).toHaveLength(1);
    expect(
      (await stub.hostAction({ ...command, requestId: crypto.randomUUID(), nowMs: -1 }))
        .ok,
    ).toBe(false);
  },
);

it.each(["iphone", "android", "unknown"])(
  "serves a reversible %s display while preserving clean bytes",
  async (family) => {
    const { stub, joined, room, credential } = await setup();
    const jpeg = encode(
      { width: 300, height: 150, data: new Uint8Array(300 * 150 * 4).fill(180) },
      95,
    ).data;
    const mediaId = crypto.randomUUID(),
      finalKey = `accepted/${room.gameId}/${mediaId}.jpg`;
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO media_upload (upload_id, request_id, player_id, kind, question_index, temp_key, final_key, media_id, status, attempts, created_at, hidden, purpose, content_type, photo_family) VALUES (?, ?, ?, 'photo', 0, 'temp/unused', ?, ?, 'accepted', 0, ?, 0, 'face', 'image/jpeg', ?)`,
        crypto.randomUUID(),
        crypto.randomUUID(),
        joined.playerId,
        finalKey,
        mediaId,
        Date.now(),
        family,
      );
    });
    await env.MEDIA_BUCKET.put(finalKey, jpeg);
    const url = `http://example.com/api/rooms/${room.gameId}/media/${mediaId}`;
    const headers = {
      cookie: `26_guest=${room.gameId}.${joined.playerId}.${joined.secret}`,
    };
    expect((await apiFetch(url)).status).toBe(401);
    const shown = await apiFetch(url, { headers });
    expect(shown.status).toBe(200);
    const displayed = new Uint8Array(await shown.arrayBuffer());
    expect(decode(displayed).width).toBe(family === "iphone" ? 256 : 300);
    expect(
      new Uint8Array(await (await env.MEDIA_BUCKET.get(finalKey))!.arrayBuffer()),
    ).toEqual(new Uint8Array(jpeg));
    await stub.hostAction({
      ...credential,
      action: "photo-bias-off",
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    const restored = await apiFetch(`${url}?display=1`, { headers });
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array(jpeg));
    await stub.hostAction({
      ...credential,
      action: "photo-bias-on",
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    // A cached rough image must never outlive the room's current visibility check.
    await stub.hostAction({
      ...credential,
      action: "hide-media",
      mediaId,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect((await apiFetch(url, { headers })).status).toBe(404);
  },
);

it("pins the reported uploader family at reservation, without treating it as identity", async () => {
  const { stub, joined } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const id = crypto.randomUUID();
    state.storage.sql.exec(
      `INSERT INTO device_context (context_id, player_id, collector_version, participating, material_hash, report_json, created_at, updated_at) VALUES (?, ?, 1, 1, 'hash', ?, ?, ?)`,
      id,
      joined.playerId,
      JSON.stringify({ deviceFamily: "iphone", classification: "reported" }),
      Date.now(),
      Date.now(),
    );
    state.storage.sql.exec(
      `UPDATE player SET device_context_id = ? WHERE player_id = ?`,
      id,
      joined.playerId,
    );
  });
  const upload = await stub.reserveMedia({
    playerId: joined.playerId,
    secret: joined.secret,
    requestId: crypto.randomUUID(),
    kind: "photo",
    purpose: "face",
    nowMs: Date.now(),
  });
  expect(upload.ok).toBe(true);
  const family = await runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ photo_family: string }>(`SELECT photo_family FROM media_upload`)
        .toArray()[0]?.photo_family,
  );
  expect(family).toBe("iphone");
});
