import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { applyHostAction } from "../src/room/host-actions.ts";
import { assertKartLobbyAction } from "../src/room/kart-lobby.ts";

it("creates a durable kart-only lobby once without changing the birthday order", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const before = await registry.birthdayOrder();
  const input = {
    requestId: crypto.randomUUID(),
    kind: "kart" as const,
    digest: await payloadDigest({ action: "create", kind: "kart" }),
    now: new Date(Date.now() + 60_000).toISOString(),
  };
  const created = await registry.createLobby(input);
  if (!created.ok) throw new Error(created.message);
  await evictDurableObject(registry);
  expect(await registry.createLobby(input)).toEqual(created);
  expect((await registry.createLobby({ ...input, kind: "party" })).ok).toBe(false);
  expect(await registry.birthdayOrder()).toEqual(before);
  const room = env.PARTY_ROOM.getByName(created.result.gameId);
  await evictDurableObject(room);
  const host = await room.snapshotFor("control");
  expect(host.kartLobby).toEqual({ createdAt: Date.parse(input.now) });
  expect(host.phase).toBe("lobby");
  expect(host.players).toHaveLength(0);
  expect(host.questionSetVersion).toMatch(/^kart-birthday-r0-/);
  await runInDurableObject(room, (_instance, state) => {
    for (const action of [
      "start-demo",
      "start-birthday",
      "start-kart-rehearsal",
      "start-fixture",
      "developer-configure",
    ])
      expect(() => assertKartLobbyAction(state.storage.sql, action)).toThrow(
        "kart-only lobby",
      );
  });
  for (const audience of ["stage", "guest"] as const) {
    const view = await room.snapshotFor(audience);
    expect(view.kartLobby).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("birthday-script");
    expect(JSON.stringify(view)).not.toContain("notes");
  }
});

it("authorises and replays the race start, freezes late arrivals and ends without quiz facts", async () => {
  const now = Date.now() + 60_000;
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    kind: "kart",
    digest: await payloadDigest({ action: "create", kind: "kart" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = env.PARTY_ROOM.getByName(created.result.gameId);
  await room.joinPlayer({
    nickname: "Amina",
    requestId: crypto.randomUUID(),
    now: new Date(now).toISOString(),
  });
  const command = {
    ...created.result.control,
    action: "start-kart",
    requestId: crypto.randomUUID(),
    nowMs: now,
  };
  expect((await room.hostAction({ ...command, secret: "wrong" })).ok).toBe(false);
  expect((await room.snapshotFor("control")).phase).toBe("lobby");
  const first = await room.hostAction(command);
  expect(first.ok).toBe(true);
  await evictDurableObject(room);
  expect(await room.hostAction(command)).toEqual(first);
  const intro = await room.snapshotFor("stage");
  expect(intro.play?.question.kind).toBe("kart");
  expect(intro.play?.question.total).toBe(1);
  expect(intro.play?.kart?.trackId).toBe("mario-circuit-v1");
  expect(intro.play?.kart?.participantCount).toBe(1);
  const late = await room.joinPlayer({
    nickname: "Bilal",
    requestId: crypto.randomUUID(),
    now: new Date(now + 1).toISOString(),
  });
  expect(late.ok).toBe(true);
  const phases = [];
  for (let n = 1; n <= 6; n++) {
    const advanced = await room.advanceRound({
      ...created.result.control,
      requestId: crypto.randomUUID(),
      nowMs: now + n * 100,
    });
    expect(advanced.ok).toBe(true);
    phases.push((await room.snapshotFor("stage")).phase);
  }
  expect(phases).toEqual(["prompt", "collect", "reveal", "scores", "final", "podium"]);
  expect((await room.snapshotFor("stage")).play?.kart?.participantCount).toBe(1);
});

it("refuses the kart start domain command in an ordinary lobby without changing it", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = env.PARTY_ROOM.getByName(created.result.gameId);
  await runInDurableObject(room, (_instance, state) => {
    expect(() =>
      applyHostAction(state.storage.sql, {
        action: "start-kart",
        now: new Date().toISOString(),
        nowMs: Date.now(),
      }),
    ).toThrow("fresh kart-only lobby");
  });
  expect((await room.snapshotFor("control")).phase).toBe("lobby");
});
