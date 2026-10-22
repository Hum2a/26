import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { questionFor } from "../src/questions/registry.ts";

it("persists order saves and receipts, rejects stale/invalid edits and survives eviction", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const input = { requestId: crypto.randomUUID(), expectedRevision: current.revision, ids: ["car-name", "kart-sprint"] };
  const saved = await registry.updateBirthdayOrder(input, 1000);
  await evictDurableObject(registry);
  expect(await registry.updateBirthdayOrder(input, 2000)).toEqual(saved);
  expect((await registry.birthdayOrder()).history.at(-1)).toMatchObject({ count: 2, at: 1000 });
  await expect(registry.updateBirthdayOrder({ ...input, requestId: crypto.randomUUID() }, 2000)).rejects.toThrow(/another tab/);
  await expect(registry.updateBirthdayOrder({ ...input, expectedRevision: saved.revision, requestId: crypto.randomUUID(), ids: ["tribunal-reddit"] }, 2000)).rejects.toThrow();
  expect(await registry.birthdayOrder()).toEqual(saved);
});

it("starts the saved birthday order, freezes it through edits/restarts, and never exposes private script data", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const saved = await registry.updateBirthdayOrder({ requestId: crypto.randomUUID(), expectedRevision: current.revision, ids: ["car-name", "kart-sprint"] }, 1000);
  const now = Date.now() + 60_000;
  const created = await registry.createLobby({ requestId: crypto.randomUUID(), digest: await payloadDigest({ action: "create" }), now: new Date(now).toISOString() });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const joined = await stub.joinPlayer({ nickname: "Guest", requestId: crypto.randomUUID(), now: new Date(now).toISOString() });
  if (!joined.ok) throw new Error(joined.message);
  const input = { credentialId: created.result.control.credentialId, secret: created.result.control.secret, requestId: crypto.randomUUID(), nowMs: now };
  const started = await stub.startBirthday(input);
  expect(started.ok).toBe(true);
  await registry.updateBirthdayOrder({ requestId: crypto.randomUUID(), expectedRevision: saved.revision, ids: ["kart-sprint", "car-name"] }, 2000);
  await evictDurableObject(stub);
  expect(await stub.startBirthday(input)).toEqual(started);
  for (const audience of ["control", "stage", "guest"] as const) {
    const snapshot = await stub.snapshotFor(audience, audience === "guest" ? joined.playerId : undefined);
    expect(snapshot.play?.question.id).toBe("car-name");
    expect(snapshot).not.toHaveProperty("questionScript");
    expect(JSON.stringify(snapshot)).not.toContain("__pack");
  }
  await runInDurableObject(stub, (_instance, state) => {
    const room = createSqlStore(state.storage.sql).readRoom();
    expect(room.questionScript?.questions.map(q => q.id)).toEqual(["car-name", "kart-sprint"]);
    expect(questionFor({ ...room, questionIndex: 1 })?.kind).toBe("kart");
  });
  expect((await stub.startBirthday({ ...input, requestId: crypto.randomUUID() })).ok).toBe(false);
});
