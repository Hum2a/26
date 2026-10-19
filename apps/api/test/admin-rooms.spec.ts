import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest";
import { withClientApiKeyHeaders, withClientApiQuery } from "./client-api-key";

describe("recoverable admin rooms", () => {
  it("pages all accepted media privately without exposing object keys or rejected uploads", async () => {
    const now = new Date().toISOString();
    const created = await env.ROOM_CODE_REGISTRY.getByName(
      `media-${crypto.randomUUID()}`,
    ).createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now,
    });
    if (!created.ok) throw new Error("Room creation failed");
    const room = env.PARTY_ROOM.getByName(created.result.gameId);
    const player = await room.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!player.ok) throw new Error("Join failed");
    await runInDurableObject(room, async (_instance, state) => {
      for (let index = 0; index < 52; index++)
        state.storage.sql.exec(
          `INSERT INTO media_upload (upload_id, request_id, player_id, kind, question_index, temp_key, final_key, media_id, status, attempts, created_at, hidden, content_type) VALUES (?, ?, ?, 'photo', 0, 'private-temp', 'private-final', ?, ?, 1, ?, ?, 'image/jpeg')`,
          crypto.randomUUID(),
          crypto.randomUUID(),
          player.playerId,
          crypto.randomUUID(),
          index === 0 ? "rejected" : "accepted",
          index,
          index === 1 ? 1 : 0,
        );
    });
    const auth = { ...created.result.control, nowMs: Date.now() };
    const first = await room.adminMediaPage(auth);
    if (!first.ok) throw new Error("Media page failed");
    expect(first.page.items).toHaveLength(50);
    expect(first.page.nextCursor).not.toBeNull();
    const second = await room.adminMediaPage({
      ...auth,
      before: Number(first.page.nextCursor),
    });
    if (!second.ok) throw new Error("Media page failed");
    expect(second.page.items).toHaveLength(1);
    expect(second.page.items[0]?.hidden).toBe(true);
    expect(second.page.nextCursor).toBeNull();
    expect(
      new Set([...first.page.items, ...second.page.items].map((item) => item.mediaId))
        .size,
    ).toBe(51);
    expect(JSON.stringify(first.page)).not.toContain("private-");
    expect((await room.adminMediaPage({ ...auth, secret: "incorrect" })).ok).toBe(
      false,
    );
    expect(
      (
        await room.readMedia({
          mediaId: second.page.items[0]!.mediaId,
          nowMs: Date.now(),
          credential: { ...created.result.control, role: "control" },
        })
      ).ok,
    ).toBe(false);
  });
  it("persists removed players and adjustments in a private control projection", async () => {
    const now = new Date().toISOString();
    const created = await env.ROOM_CODE_REGISTRY.getByName(
      `players-${crypto.randomUUID()}`,
    ).createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now,
    });
    if (!created.ok) throw new Error("Room creation failed");
    const room = env.PARTY_ROOM.getByName(created.result.gameId);
    const joined = await room.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!joined.ok) throw new Error("Join failed");
    const base = {
      ...created.result.control,
      nowMs: Date.now(),
      playerId: joined.playerId,
    };
    const adjustment = {
      ...base,
      action: "adjust" as const,
      points: -25,
      reason: "Private operator correction",
      requestId: crypto.randomUUID(),
    };
    expect((await room.hostAction(adjustment)).ok).toBe(true);
    expect((await room.hostAction(adjustment)).ok).toBe(true);
    expect(
      (
        await room.hostAction({
          ...base,
          action: "kick",
          requestId: crypto.randomUUID(),
        })
      ).ok,
    ).toBe(true);
    await evictDurableObject(room);
    const control = await room.snapshotFor("control");
    expect(control.adminPlayers).toEqual([
      {
        playerId: joined.playerId,
        nickname: "Amina",
        points: -25,
        removed: true,
        connected: false,
        answered: null,
      },
    ]);
    expect(control.adjustments).toHaveLength(1);
    for (const audience of ["guest", "stage"] as const) {
      const projection = await room.snapshotFor(audience);
      expect(projection.adminPlayers).toBeUndefined();
      expect(projection.adjustments).toBeUndefined();
      expect(projection.players).toHaveLength(0);
      expect(JSON.stringify(projection)).not.toContain("Private operator correction");
      expect(JSON.stringify(projection)).not.toContain(created.result.control.secret);
    }
  });
  it("lists an empty registry and uses stable pagination without room fanout", async () => {
    const registry = env.ROOM_CODE_REGISTRY.getByName(`list-${crypto.randomUUID()}`);
    expect(await registry.listRooms({ limit: 2 })).toEqual({
      rooms: [],
      nextCursor: null,
    });
    const now = new Date().toISOString();
    for (const [joinCode, gameId] of [
      ["ABCDEF", "ABCDEFGH"],
      ["GHJKLM", "GHJKLMNP"],
      ["NPQRST", "NPQRSTUV"],
    ])
      await registry.claim({ joinCode: joinCode!, gameId: gameId!, createdAt: now });
    const first = await registry.listRooms({ limit: 2 });
    expect(first.rooms.map((room) => room.gameId)).toEqual(["NPQRSTUV", "GHJKLMNP"]);
    expect(first.nextCursor).not.toBeNull();
    const last = await registry.listRooms({
      limit: 2,
      before: Number(first.nextCursor),
    });
    expect(last.rooms.map((room) => room.gameId)).toEqual(["ABCDEFGH"]);
    expect(last.nextCursor).toBeNull();
    expect(Object.keys(first.rooms[0]!).sort()).toEqual([
      "createdAt",
      "gameId",
      "joinCode",
    ]);
  });
  it("recovers current state, persists credentials and rejects revoked or expired access", async () => {
    const registry = env.ROOM_CODE_REGISTRY.getByName(`recover-${crypto.randomUUID()}`);
    const now = new Date().toISOString();
    const created = await registry.createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("Room creation failed");
    const room = env.PARTY_ROOM.getByName(created.result.gameId);
    await room.joinPlayer({ nickname: "Guest", requestId: crypto.randomUUID(), now });
    const requestId = crypto.randomUUID();
    const resumed = await room.resumeAdmin({ requestId, now });
    if (!resumed.ok) throw new Error("Room resume failed");
    expect(resumed.snapshot.players).toHaveLength(1);
    expect(await room.resumeAdmin({ requestId, now })).toMatchObject({
      ok: true,
      control: resumed.control,
      presentation: resumed.presentation,
      snapshot: {
        gameId: resumed.snapshot.gameId,
        stateVersion: resumed.snapshot.stateVersion,
      },
    });
    await runInDurableObject(room, async (_instance, state) => {
      expect(
        state.storage.sql
          .exec<{ total: number }>(
            "SELECT COUNT(*) AS total FROM credential WHERE id = ?",
            resumed.control.credentialId,
          )
          .one().total,
      ).toBe(1);
    });
    expect((await room.adminRoom({ ...resumed.control, now })).ok).toBe(true);
    expect(
      (await room.adminRoom({ ...resumed.control, now: "2099-01-01T00:00:00.000Z" }))
        .ok,
    ).toBe(false);
    const response = await room.fetch(
      new Request(
        withClientApiQuery(
          `http://example.com/ws/${created.result.gameId}?role=control`,
        ),
        {
          headers: withClientApiKeyHeaders({
            Upgrade: "websocket",
            Connection: "Upgrade",
            Origin: "http://example.com",
            Cookie: `26_room_control=${resumed.control.credentialId}.${resumed.control.secret}`,
          }),
        },
      ),
    );
    expect(response.status).toBe(101);
    const socket = response.webSocket!;
    socket.accept();
    const replaced = new Promise<Record<string, unknown>>((resolve) =>
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.kind === "replaced") resolve(message);
      }),
    );
    await room.releaseAdmin({ ...resumed.control, role: "control", now });
    expect(await replaced).toMatchObject({
      kind: "replaced",
      message: "Room access changed in this browser. Reopen the room from admin.",
    });
    socket.close();
    expect((await room.adminRoom({ ...resumed.control, now })).ok).toBe(false);
    expect((await room.resumeAdmin({ requestId, now })).ok).toBe(false);
    const fresh = await room.resumeAdmin({ requestId: crypto.randomUUID(), now });
    expect(fresh.ok).toBe(true);
    // Other operators' credentials and all game data survive renewal.
    expect((await room.adminRoom({ ...created.result.control, now })).ok).toBe(true);
    expect((await room.snapshotFor("control")).players).toHaveLength(1);
  });
  it("does not create a missing room when asked to resume", async () => {
    const room = env.PARTY_ROOM.getByName(`missing-${crypto.randomUUID()}`);
    expect(
      await room.resumeAdmin({
        requestId: crypto.randomUUID(),
        now: new Date().toISOString(),
      }),
    ).toMatchObject({ ok: false, error: "not_found" });
  });
});
