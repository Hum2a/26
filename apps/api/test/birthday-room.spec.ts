import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { questionFor } from "../src/questions/registry.ts";

it("persists order saves and receipts, rejects stale/invalid edits and survives eviction", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const input = {
    requestId: crypto.randomUUID(),
    expectedRevision: current.revision,
    ids: ["car-name", "kart-sprint"],
  };
  const saved = await registry.updateBirthdayOrder(input, 1000);
  if ("error" in saved) throw new Error(saved.message);
  await evictDurableObject(registry);
  expect(await registry.updateBirthdayOrder(input, 2000)).toEqual(saved);
  expect((await registry.birthdayOrder()).history.at(-1)).toMatchObject({
    count: 2,
    at: 1000,
  });
  await expect(
    registry.updateBirthdayOrder({ ...input, requestId: crypto.randomUUID() }, 2000),
  ).resolves.toMatchObject({
    error: "invalid",
    message: expect.stringContaining("another tab"),
  });
  await expect(
    registry.updateBirthdayOrder(
      {
        ...input,
        expectedRevision: saved.revision,
        requestId: crypto.randomUUID(),
        ids: ["tribunal-reddit"],
      },
      2000,
    ),
  ).resolves.toMatchObject({ error: "invalid" });
  expect(await registry.birthdayOrder()).toEqual(saved);
});

it("starts the saved birthday order, freezes it through edits/restarts, and never exposes private script data", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const saved = await registry.updateBirthdayOrder(
    {
      requestId: crypto.randomUUID(),
      expectedRevision: current.revision,
      ids: ["car-name", "kart-sprint"],
    },
    1000,
  );
  if ("error" in saved) throw new Error(saved.message);
  const now = Date.now() + 60_000;
  const created = await registry.createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const joined = await stub.joinPlayer({
    nickname: "Guest",
    requestId: crypto.randomUUID(),
    now: new Date(now).toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  const input = {
    credentialId: created.result.control.credentialId,
    secret: created.result.control.secret,
    requestId: crypto.randomUUID(),
    nowMs: now,
  };
  const started = await stub.startBirthday(input);
  expect(started.ok).toBe(true);
  await registry.updateBirthdayOrder(
    {
      requestId: crypto.randomUUID(),
      expectedRevision: saved.revision,
      ids: ["kart-sprint", "car-name"],
    },
    2000,
  );
  await evictDurableObject(stub);
  expect(await stub.startBirthday(input)).toEqual(started);
  for (const audience of ["control", "stage", "guest"] as const) {
    const snapshot = await stub.snapshotFor(
      audience,
      audience === "guest" ? joined.playerId : undefined,
    );
    expect(snapshot.play?.question.id).toBe("car-name");
    expect(snapshot).not.toHaveProperty("questionScript");
    expect(JSON.stringify(snapshot)).not.toContain("__pack");
  }
  await runInDurableObject(stub, (_instance, state) => {
    const room = createSqlStore(state.storage.sql).readRoom();
    expect(room.questionScript?.questions.map((q) => q.id)).toEqual([
      "car-name",
      "kart-sprint",
    ]);
    expect(questionFor({ ...room, questionIndex: 1 })?.kind).toBe("kart");
  });
  const refusedInput = { ...input, requestId: crypto.randomUUID() };
  const refused = await stub.startBirthday(refusedInput);
  expect(refused.ok).toBe(false);
  await evictDurableObject(stub);
  expect(await stub.startBirthday(refusedInput)).toEqual(refused);
});

it("starts eighty racers on the imported circuit using ledger totals and adjustments, then pauses and restores", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const order = await registry.updateBirthdayOrder(
    {
      requestId: crypto.randomUUID(),
      expectedRevision: current.revision,
      ids: ["kart-sprint"],
    },
    1000,
  );
  if ("error" in order) throw new Error(order.message);
  const now = Date.now() + 60000;
  const created = await registry.createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const ids: string[] = [];
  for (let i = 0; i < 80; i++) {
    const joined = await stub.joinPlayer({
      nickname: `Racer ${i}`,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    ids.push(joined.playerId);
  }
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    sql.exec(
      "INSERT INTO score_ledger (question_id,player_id,points,detail,created_at) VALUES ('prior',?,100,'quiz',?)",
      ids[2]!,
      now,
    );
    sql.exec(
      "INSERT INTO score_adjustment (adjustment_id,player_id,points,reason,created_at) VALUES ('adjust',?,150,'Host adjustment',?)",
      ids[3]!,
      now,
    );
  });
  const credential = {
    credentialId: created.result.control.credentialId,
    secret: created.result.control.secret,
  };
  expect(
    (
      await stub.startBirthday({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  const grid = (await stub.snapshotFor("stage")).play!.kart!;
  expect(grid).toMatchObject({
    trackId: "mario-circuit-v1",
    timeLimitMs: 180000,
    participantCount: 80,
  });
  expect(grid.participants.slice(0, 3).map((d) => d.playerId)).toEqual([
    ids[3],
    ids[2],
    ids[0],
  ]);
  for (let n = 1; n <= 2; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect(
    (
      await stub.pauseRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 100,
      })
    ).ok,
  ).toBe(true);
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("stage")).paused).toBe(true);
  expect(
    (
      await stub.resumeRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 1000,
      })
    ).ok,
  ).toBe(true);
  const guest = (await stub.snapshotFor("guest", ids[3])).play!.kart!;
  expect(guest.participants).toHaveLength(1);
  expect(guest.participants[0]!.gridPosition).toBe(1);
  expect(guest.timeLimitMs).toBe(180000);
});
