import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { chooseKartLobbyTrack } from "../src/room/kart-lobby.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { rejectOldKartTrackClient } from "../src/room/kart-track-compatibility.ts";

async function lobby() {
  const now = Date.now() + 60000;
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    kind: "kart",
    digest: await payloadDigest({ action: "create", kind: "kart" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) throw Error(created.message);
  return {
    room: env.PARTY_ROOM.getByName(created.result.gameId),
    credential: created.result.control,
    now,
  };
}
it("persists a receipted choice once, freezes the room-owned script, preserves packs and refuses changes after start", async () => {
  const before = await env.ROOM_CODE_REGISTRY.getByName("codes").birthdayOrder();
  const { room, credential, now } = await lobby();
  const command = {
    ...credential,
    action: "kart-track",
    kartTrack: "26-park-v1",
    requestId: crypto.randomUUID(),
    nowMs: now + 1,
  };
  expect((await room.hostAction({ ...command, secret: "wrong" })).ok).toBe(false);
  const accepted = await room.hostAction(command);
  expect(accepted.ok).toBe(true);
  await evictDurableObject(room);
  expect(await room.hostAction(command)).toEqual(accepted);
  expect(
    (await room.hostAction({ ...command, kartTrack: "mario-circuit-v1" })).ok,
  ).toBe(false);
  const control = await room.snapshotFor("control");
  expect(control.kartLobby?.trackId).toBe("26-park-v1");
  expect(control.kartLobby?.history).toHaveLength(1);
  for (const role of ["stage", "guest"] as const)
    expect((await room.snapshotFor(role)).kartLobby).toBeUndefined();
  expect(
    (
      await room.hostAction({
        ...credential,
        action: "start-kart",
        requestId: crypto.randomUUID(),
        nowMs: now + 2,
      })
    ).ok,
  ).toBe(true);
  const stage = await room.snapshotFor("stage");
  expect(stage.play?.kart?.trackId).toBe("26-park-v1");
  expect(stage.play?.question).toMatchObject({
    kind: "kart",
    trackId: "26-park-v1",
    timeLimitMs: 180000,
  });
  await runInDurableObject(room, (_instance, state) => {
    expect(() =>
      chooseKartLobbyTrack(state.storage.sql, "party-ring-v1", now + 3),
    ).toThrow("fresh kart-only lobby");
    const clock = createSqlStore(state.storage.sql).readRoom();
    expect(clock.questionScript!.version).toBe(clock.questionSetVersion);
  });
  expect(
    (
      await room.hostAction({
        ...command,
        requestId: crypto.randomUUID(),
        nowMs: now + 3,
      })
    ).ok,
  ).toBe(false);
  expect(await env.ROOM_CODE_REGISTRY.getByName("codes").birthdayOrder()).toEqual(
    before,
  );
});
it("validates again in the domain and uses the selected ring clock without accumulating version suffixes", async () => {
  const { room, credential, now } = await lobby();
  await runInDurableObject(room, (_instance, state) => {
    expect(() => chooseKartLobbyTrack(state.storage.sql, "unknown", now)).toThrow();
    expect(() => chooseKartLobbyTrack(state.storage.sql, "26-park-v1", NaN)).toThrow();
  });
  for (const track of ["26-park-v1", "mario-circuit-v1", "party-ring-v1"])
    expect(
      (
        await room.hostAction({
          ...credential,
          action: "kart-track",
          kartTrack: track,
          requestId: crypto.randomUUID(),
          nowMs: now + 1,
        })
      ).ok,
    ).toBe(true);
  expect(
    (await room.snapshotFor("control")).questionSetVersion.match(/-course-/g),
  ).toHaveLength(1);
  expect(
    (
      await room.hostAction({
        ...credential,
        action: "start-kart",
        requestId: crypto.randomUUID(),
        nowMs: now + 2,
      })
    ).ok,
  ).toBe(true);
  for (let i = 3; i <= 4; i++)
    expect(
      (
        await room.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + i,
        })
      ).ok,
    ).toBe(true);
  const view = await room.snapshotFor("stage");
  expect(view.play?.kart?.trackId).toBe("party-ring-v1");
  expect(view.deadlineAt).toBe(now + 4 + 45000);
});
it("refreshes old sockets before any park snapshot/patch/frame and keeps capable sockets usable through eviction", async () => {
  const { room, credential, now } = await lobby();
  await room.hostAction({
    ...credential,
    action: "kart-track",
    kartTrack: "26-park-v1",
    requestId: crypto.randomUUID(),
    nowMs: now + 1,
  });
  await room.hostAction({
    ...credential,
    action: "start-kart",
    requestId: crypto.randomUUID(),
    nowMs: now + 2,
  });
  await evictDurableObject(room);
  await runInDurableObject(room, async (instance, state) => {
    const old = new WebSocketPair(),
      current = new WebSocketPair();
    for (const [pair, capable] of [
      [old, false],
      [current, true],
    ] as const) {
      state.acceptWebSocket(pair[1], ["presentation"]);
      pair[1].serializeAttachment({
        role: "presentation",
        principalId: credential.credentialId,
        deliverySeq: 0,
        kartItems: 2,
        ...(capable ? { kartTracks: 2 } : {}),
      });
      pair[0].accept();
    }
    const older: Record<string, unknown>[] = [],
      newer: Record<string, unknown>[] = [];
    old[0].addEventListener("message", (e) => {
      older.push(JSON.parse(String(e.data)));
    });
    current[0].addEventListener("message", (e) => {
      newer.push(JSON.parse(String(e.data)));
    });
    try {
      await instance.hostAction({
        ...credential,
        action: "pause",
        requestId: crypto.randomUUID(),
        nowMs: now + 3,
      });
      await expect
        .poll(() => older.find((m) => m.kind === "replaced"))
        .toMatchObject({ message: expect.stringContaining("Refresh") });
      expect(
        older.filter((m) => ["snapshot", "patch", "kart"].includes(String(m.kind))),
      ).toEqual([]);
      await expect.poll(() => newer.some((m) => m.kind === "snapshot")).toBe(true);
    } finally {
      old[0].close();
      current[0].close();
      current[1].close();
    }
  });
  const view = await room.snapshotFor("stage");
  const rejected = rejectOldKartTrackClient(new Request("https://example.com"), view)!;
  expect(rejected.status).toBe(409);
  expect(await rejected.text()).not.toContain("26-park-v1");
  expect(
    rejectOldKartTrackClient(
      new Request("https://example.com", { headers: { "x-26-kart-tracks": "2" } }),
      view,
    ),
  ).toBeUndefined();
});
