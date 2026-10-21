import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { createGameStore } from "../src/questions/multiple-choice.ts";
import { onAlarm, pause, resume, publicClock } from "../src/room/lifecycle.ts";
import { acceptKartInput, readKart, KartInputBuffer } from "../src/questions/kart.ts";
import { questionFor } from "../src/questions/registry.ts";
import { kartNeutral } from "@26/shared";

async function setup(names = ["Amina", "Bilal"]) {
  // Keep automatic wall-clock alarms in the future; tests explicitly drive the injected clock.
  const now = Date.now() + 60_000,
    created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now: new Date(now).toISOString(),
    });
  if (!created.ok) throw new Error(created.message);
  const room = created.result,
    stub = env.PARTY_ROOM.getByName(room.gameId);
  const players = [];
  for (const nickname of names) {
    const p = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!p.ok) throw new Error(p.message);
    players.push(p.playerId);
  }
  const credential = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  expect(
    (
      await stub.startKartRehearsal({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  // Actual first quiz -> actual second kart intro, using the same authoritative phase graph.
  for (let n = 1; n <= 5; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.question.kind).toBe("kart");
  for (let n = 6; n <= 7; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  return { stub, players, now: now + 7, credential };
}

it("bounds each driver's transient controls without letting invalid or noisy inputs evict a peer", () => {
  const buffer = new KartInputBuffer();
  const input = { raceId: "race", sequence: 1, ...kartNeutral };
  buffer.push("quiet", input, 0);
  buffer.push("noisy", input, 0);
  for (let n = 1; n <= 1000; n++) {
    buffer.push("noisy", { ...input, sequence: n + 1 }, n * 100);
    buffer.push("quiet", { ...input, sequence: n + 1, steer: 9 }, n * 100);
  }
  buffer.push("noisy", input, 100_100);
  const arrivals = buffer.drain();
  expect(arrivals.filter((entry) => entry.playerId === "quiet")).toEqual([
    { playerId: "quiet", raw: input, at: 0 },
  ]);
  expect(arrivals.filter((entry) => entry.playerId === "noisy")).toHaveLength(4);
  expect((arrivals.at(-1)!.raw as typeof input).sequence).toBe(1001);
  expect(buffer.drain()).toEqual([]);
});

it("releases persisted throttle and drift at pause while retaining the reconnect cursor", async () => {
  const { stub, players, now, credential } = await setup();
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const store = createSqlStore(state.storage.sql);
    const q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    expect(
      acceptKartInput(
        state.storage.sql,
        store,
        players[0]!,
        { ...kartNeutral, raceId, sequence: 7, gas: true, drift: true },
        q,
        now,
      ),
    ).toBe(true);
  });
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
  const paused = (await stub.snapshotFor("guest", players[0])).play!.kart!;
  expect(paused.elapsedMs).toBe(100);
  expect(paused.inputCursor).toBe(7);
  expect(
    (
      await stub.resumeRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 10_000,
      })
    ).ok,
  ).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = questionFor(createSqlStore(sql).readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    onAlarm(createGameStore(sql), now + 10_100);
    const driver = readKart(sql, q.id)!.drivers[0]!;
    expect(driver.input).toEqual(kartNeutral);
    expect(driver.wasDrifting).toBe(false);
    expect(driver.boostMs).toBe(0);
    expect(driver.sequence).toBe(7);
    expect(
      acceptKartInput(
        sql,
        createSqlStore(sql),
        players[0]!,
        { ...kartNeutral, raceId, sequence: 8, gas: true },
        q,
        now + 10_100,
      ),
    ).toBe(true);
  });
});

it("accepts authenticated-driver controls, rejects stale/forged/late inputs and survives eviction", async () => {
  const { stub, players, now } = await setup();
  const raceId = (await stub.snapshotFor("guest", players[0])).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const input = { raceId, sequence: 1, ...kartNeutral, gas: true, steer: 0.2381 };
    expect(acceptKartInput(sql, store, players[0]!, input, q, now)).toBe(true);
    expect(
      acceptKartInput(sql, store, players[0]!, { ...input, sequence: 2 }, q, now + 1),
    ).toBe(false);
    expect(acceptKartInput(sql, store, players[0]!, input, q, now + 100)).toBe(false);
    expect(
      acceptKartInput(sql, store, players[1]!, { ...input, timeMs: 1 }, q, now + 100),
    ).toBe(false);
    expect(acceptKartInput(sql, store, "not-in-race", input, q, now + 100)).toBe(false);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { ...input, sequence: 3, raceId: "old" },
        q,
        now + 100,
      ),
    ).toBe(false);
    onAlarm(createGameStore(sql), now + 200);
    expect(readKart(sql, q.id)!.drivers[0]!.speed).toBeGreaterThan(0);
    const clock = publicClock(store);
    expect(clock.deadlineAt).toBe(now + 45_000);
    pause(store, now + 250);
    onAlarm(createGameStore(sql), now + 5000);
    expect(readKart(sql, q.id)!.elapsedMs).toBe(200);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { ...input, sequence: 4 },
        q,
        now + 5000,
      ),
    ).toBe(false);
  });
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("guest", players[0])).paused).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql);
    resume(store, now + 10_000);
    onAlarm(createGameStore(sql), now + 10_200);
    const q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    expect(readKart(sql, q.id)!.elapsedMs).toBe(450);
    const deadline = publicClock(store).deadlineAt!;
    expect(deadline).toBe(now + 54_750);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { raceId, sequence: 5, ...kartNeutral },
        q,
        deadline,
      ),
    ).toBe(false);
    onAlarm(createGameStore(sql), deadline + 100);
    expect(store.readRoom().phase).toBe("reveal"); // One transition, even when tick and cutoff are both due.
    expect(readKart(sql, q.id)!.drivers.every((d) => d.status === "DNF")).toBe(true);
    expect(
      sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) n FROM score_ledger WHERE question_id = ?",
          q.id,
        )
        .toArray()[0]!.n,
    ).toBe(2);
    onAlarm(createGameStore(sql), deadline + 200);
    expect(
      sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) n FROM score_ledger WHERE question_id = ?",
          q.id,
        )
        .toArray()[0]!.n,
    ).toBe(2);
  });
  const view = (await stub.snapshotFor("stage")).play!;
  expect(view.kart?.ended).toBe(true);
  expect(JSON.stringify(view.kart)).not.toContain("sequence");
});

it("persists lap winners once, ignores client times, and continues to scores and the final podium", async () => {
  const { stub, players, now, credential } = await setup();
  const raceId = (await stub.snapshotFor("guest", players[0])).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    for (
      let elapsed = 0;
      elapsed < 45_000 && store.readRoom().phase === "collect";
      elapsed += 100
    ) {
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { raceId, sequence: elapsed + 1, ...kartNeutral, gas: true, steer: 0.2381 },
        q,
        now + elapsed,
      );
      onAlarm(createGameStore(sql), now + elapsed + 100);
    }
    expect(readKart(sql, q.id)!.drivers[0]!.status).toBe("FINISHED");
    expect(store.readRoom().phase).toBe("reveal");
    const rows = sql
      .exec<{ points: number }>(
        "SELECT points FROM score_ledger WHERE question_id = ? ORDER BY points DESC",
        q.id,
      )
      .toArray();
    expect(rows.map((r) => r.points)).toEqual([100, 0]);
  });
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("guest", players[0])).play?.selfAward).toBe(100);
  for (let n = 0; n < 3; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + 46_000 + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).phase).toBe("podium");
});

it("persists full-room control queues before a tick and replays them after eviction without cross-driver leakage", async () => {
  const { stub, players, now } = await setup(
    Array.from({ length: 80 }, (_, i) => `Driver ${i + 1}`),
  );
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    for (let offset = 0; offset <= 100; offset += 100)
      for (const [i, playerId] of players.entries()) {
        expect(
          acceptKartInput(
            sql,
            store,
            playerId,
            {
              raceId,
              sequence: offset / 100 + 1,
              ...kartNeutral,
              gas: i % 2 === 0,
              steer: 0.24,
            },
            q,
            now + offset,
          ),
        ).toBe(true);
      }
    expect(readKart(sql, q.id)!.elapsedMs).toBe(0); // Inputs are queued, not optimistically simulated.
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    onAlarm(createGameStore(sql), now + 200);
    const saved = readKart(sql, q.id)!;
    expect(saved.drivers).toHaveLength(80);
    expect(saved.elapsedMs).toBe(200);
    for (const [i, driver] of saved.drivers.entries()) {
      expect(driver.sequence).toBe(2);
      expect(driver.speed > 0).toBe(i % 2 === 0);
    }
    // Throttle expires at 500ms; exponential coasting needs time to settle.
    onAlarm(createGameStore(sql), now + 3000);
    expect(readKart(sql, q.id)!.drivers.every((d) => Math.abs(d.speed) < 0.1)).toBe(
      true,
    );
    expect(readKart(sql, q.id)!.drivers.every((d) => d.inputUntil === 500)).toBe(true);
  });
  const guest = (await stub.snapshotFor("guest", players[79])).play!.kart!;
  expect(guest.participantCount).toBe(80);
  expect(guest.participants).toHaveLength(1);
  expect(guest.participants[0]!.playerId).toBe(players[79]);
  expect(guest.inputCursor).toBe(2);
  expect(guest.leaderboard).toHaveLength(9); // Top eight plus this phone's own place.
  expect(JSON.stringify(guest)).not.toContain("inputUntil");
});
