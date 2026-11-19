import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { kartNeutral, type KartRace } from "@26/shared";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { onAlarm } from "../src/room/lifecycle.ts";
import { createGameStore } from "../src/questions/multiple-choice.ts";
import { questionFor } from "../src/questions/registry.ts";
import {
  acceptKartFinish,
  acceptKartInput,
  acceptKartInputs,
  checkpointKart,
  KartInputBuffer,
  readKart,
} from "../src/questions/kart/kart.ts";
import { kartCheckpointWrites } from "../src/questions/kart/kart-live.ts";

/**
 * Live kart races stay in memory between checkpoints (see `kart-live.ts`).
 * These specs pin what a restart may and may not lose.
 */

async function setup(names = ["Amina", "Bilal"]) {
  // Wall-clock alarms stay in the future; each spec drives the injected clock.
  const now = Date.now() + 60_000;
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date(now).toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result,
    stub = env.PARTY_ROOM.getByName(room.gameId);
  const players = [];
  for (const nickname of names) {
    const joined = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    players.push(joined);
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
  // First quiz question, then the kart intro, prompt and collect.
  for (let n = 1; n <= 7; n++)
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
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  return {
    stub,
    gameId: room.gameId,
    players,
    playerIds: players.map((player) => player.playerId),
    raceId,
    credential,
    now: now + 7,
  };
}

function kartQuestion(sql: SqlStorage) {
  const q = questionFor(createSqlStore(sql).readRoom());
  if (q?.kind !== "kart") throw new Error("Kart required");
  return q;
}

/** The race as SQLite holds it: the last checkpoint. */
function stored(sql: SqlStorage): KartRace {
  const q = kartQuestion(sql);
  const row = sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_state WHERE question_id = ? AND state_key = 'kart-race'",
      q.id,
    )
    .toArray()[0];
  if (!row) throw new Error("No stored race");
  return JSON.parse(row.payload) as KartRace;
}

function tick(sql: SqlStorage, at: number) {
  onAlarm(createGameStore(sql), at);
}

/** Rows written by `run`, read from each cursor's `rowsWritten` (index rows included). */
function rowsWritten(sql: SqlStorage, run: () => void): number {
  const exec = sql.exec;
  const cursors: SqlStorageCursor<Record<string, SqlStorageValue>>[] = [];
  sql.exec = ((query: string, ...bindings: unknown[]) => {
    const cursor = exec.call(sql, query, ...bindings);
    cursors.push(cursor);
    return cursor;
  }) as SqlStorage["exec"];
  try {
    run();
  } finally {
    sql.exec = exec;
  }
  return cursors.reduce((sum, cursor) => sum + cursor.rowsWritten, 0);
}

it("keeps steady ticks in memory and checkpoints the race at the start and every few ticks", async () => {
  const { stub, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = kartQuestion(sql);
    const saves: number[] = [];
    let previous = stored(sql).checkpointRevision;
    for (let step = 1; step <= 3 * kartCheckpointWrites; step += 1) {
      tick(sql, now + step * 100);
      const revision = stored(sql).checkpointRevision;
      if (revision !== previous) saves.push(step);
      previous = revision;
    }
    // The first moving tick (the start) is saved at once, then one in every
    // `kartCheckpointWrites` ticks. Never every tick.
    expect(saves[0]).toBe(1);
    expect(saves.length).toBeGreaterThanOrEqual(3);
    expect(saves.length).toBeLessThanOrEqual(4);
    for (const [index, step] of saves.slice(1).entries())
      expect(step - saves[index]!).toBe(kartCheckpointWrites);
    // Readers see the live race, ahead of the checkpoint.
    const live = readKart(sql, q.id)!;
    expect(live.elapsedMs).toBe(3 * kartCheckpointWrites * 100);
    expect(live.checkpointRevision).toBeGreaterThanOrEqual(
      stored(sql).checkpointRevision ?? 0,
    );
  });
});

it("writes a handful of rows for a steady tick, not one per driver", async () => {
  const names = Array.from({ length: 20 }, (_, i) => `Driver ${i + 1}`);
  const { stub, playerIds, raceId, now } = await setup(names);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const q = kartQuestion(sql);
    tick(sql, now + 100); // The start, always saved.
    let sequence = 1;
    const drive = (at: number) => {
      sequence += 1;
      for (const [index, playerId] of playerIds.entries())
        expect(
          acceptKartInput(
            sql,
            store,
            playerId,
            {
              ...kartNeutral,
              raceId,
              sequence,
              gas: true,
              steer: index % 2 ? 0.2 : -0.2,
            },
            q,
            at,
          ),
        ).toBe(true);
    };
    drive(now + 150);
    const rows = rowsWritten(sql, () => tick(sql, now + 200));
    // One schedule row moved on (with its index). No race row, no input rows.
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThanOrEqual(4);
    const live = readKart(sql, q.id)!;
    expect(live.drivers.filter((d) => !d.cpu).every((d) => d.sequence === 2)).toBe(
      true,
    );
  });
});

it("restores the last checkpoint after a restart with a newer revision and the room clock", async () => {
  const { stub, playerIds, raceId, now } = await setup();
  let sent = 0;
  let liveElapsed = 0;
  await runInDurableObject(stub, async (instance, state) => {
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const q = kartQuestion(sql);
    expect(
      acceptKartInput(
        sql,
        store,
        playerIds[0]!,
        { ...kartNeutral, raceId, sequence: 1, gas: true },
        q,
        now + 50,
      ),
    ).toBe(true);
    for (let step = 1; step <= kartCheckpointWrites + 4; step += 1)
      tick(sql, now + step * 100);
    const live = readKart(sql, q.id)!;
    liveElapsed = live.elapsedMs;
    expect(stored(sql).elapsedMs).toBeLessThan(liveElapsed);
    sent = (await instance.snapshotFor("guest", playerIds[0])).play!.kart!.rollback!
      .revision;
  });
  await evictDurableObject(stub);
  const restored = (await stub.snapshotFor("guest", playerIds[0])).play!.kart!;
  // A phone ignores a checkpoint revision it has already passed.
  expect(restored.rollback!.revision).toBeGreaterThan(sent);
  expect(restored.raceId).toBe(raceId);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = kartQuestion(sql);
    // The kart moved before the restart and is not reset to the grid.
    const before = readKart(sql, q.id)!;
    expect(before.elapsedMs).toBeGreaterThan(0);
    expect(before.drivers[0]!.sequence).toBe(1);
    // The next tick replays from the checkpoint to the room clock.
    tick(sql, now + (kartCheckpointWrites + 5) * 100);
    expect(readKart(sql, q.id)!.elapsedMs).toBeGreaterThan(liveElapsed);
    // The restored revision is saved by the next write, so a second restart
    // cannot hand out the same revision again.
    expect(stored(sql).checkpointRevision).toBeGreaterThan(sent);
  });
});

it("saves the live race before a host pause, keeps it through resume and a restart", async () => {
  const { stub, playerIds, raceId, credential, now } = await setup();
  let paused: KartRace | undefined;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = kartQuestion(sql);
    expect(
      acceptKartInput(
        sql,
        createSqlStore(sql),
        playerIds[0]!,
        { ...kartNeutral, raceId, sequence: 1, gas: true },
        q,
        now + 50,
      ),
    ).toBe(true);
    for (let step = 1; step <= 4; step += 1) tick(sql, now + step * 100);
    expect(stored(sql).elapsedMs).toBeLessThan(readKart(sql, q.id)!.elapsedMs);
  });
  const pause = await stub.pauseRound({
    ...credential,
    requestId: crypto.randomUUID(),
    nowMs: now + 450,
  });
  expect(pause.ok).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    paused = stored(sql);
    expect(paused.elapsedMs).toBe(readKart(sql, kartQuestion(sql).id)!.elapsedMs);
    expect(paused.elapsedMs).toBeGreaterThanOrEqual(400);
  });
  await evictDurableObject(stub);
  const resume = await stub.resumeRound({
    ...credential,
    requestId: crypto.randomUUID(),
    nowMs: now + 5_000,
  });
  expect(resume.ok).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const race = readKart(sql, kartQuestion(sql).id)!;
    // A pause excludes time: the race resumes where it was paused.
    expect(race.elapsedMs).toBe(paused!.elapsedMs);
    expect(race.drivers[0]!.x).toBe(paused!.drivers[0]!.x);
    expect(race.drivers[0]!.sequence).toBe(1);
  });
});

it("saves the live race when a phone reconnects and when it drops", async () => {
  const { stub, gameId, players, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    for (let step = 1; step <= 4; step += 1) tick(sql, now + step * 100);
    expect(stored(sql).elapsedMs).toBe(100);
    expect(readKart(sql, kartQuestion(sql).id)!.elapsedMs).toBe(400);
  });
  const player = players[0]!;
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
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    expect(stored(sql).elapsedMs).toBe(400);
    for (let step = 5; step <= 7; step += 1) tick(sql, now + step * 100);
    expect(stored(sql).elapsedMs).toBe(400);
  });
  socket.close();
  await expect
    .poll(() =>
      runInDurableObject(
        stub,
        (_instance, state) => stored(state.storage.sql).elapsedMs,
      ),
    )
    .toBe(700);
});

it("drops a rolled-back finish from memory and accepts the retry", async () => {
  const { stub, playerIds, raceId, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = kartQuestion(sql);
    tick(sql, now + 100);
    const report = { raceId, elapsedMs: 12_345, lapsMs: [12_345] };
    expect(() =>
      state.storage.transactionSync(() => {
        const accepted = acceptKartFinish(
          sql,
          createSqlStore(sql),
          q,
          playerIds[0]!,
          report,
          now + 150,
        );
        expect(accepted.ok).toBe(true);
        throw new Error("The reply failed after the finish was written.");
      }),
    ).toThrow("reply failed");
    expect(readKart(sql, q.id)!.drivers[0]!.status).toBe("RACING");
    expect(
      acceptKartFinish(sql, createSqlStore(sql), q, playerIds[0]!, report, now + 160)
        .ok,
    ).toBe(true);
    expect(stored(sql).drivers[0]!.status).toBe("FINISHED");
    expect(stored(sql).drivers[0]!.lapTimeMs).toBe(12_345);
  });
});

it("a pedal release reaches the room's race and survives the next checkpoint and a restart", async () => {
  const { stub, playerIds, raceId, now } = await setup();
  await runInDurableObject(stub, async (instance, state) => {
    const sql = state.storage.sql;
    const q = kartQuestion(sql);
    // The room's own ingress: the per-driver buffer, flushed once per tick.
    const arrivals = new KartInputBuffer();
    const control = (sequence: number, gas: boolean, at: number) => {
      arrivals.push(playerIds[0]!, { ...kartNeutral, raceId, sequence, gas }, at);
      expect(
        acceptKartInputs(sql, createSqlStore(sql), arrivals.drain(), q).every(Boolean),
      ).toBe(true);
    };
    control(1, true, now + 50);
    tick(sql, now + 200);
    expect(readKart(sql, q.id)!.drivers[0]!.input.gas).toBe(true);
    expect(readKart(sql, q.id)!.drivers[0]!.speed).toBeGreaterThan(0);
    // Release on the next beat: same race, next sequence.
    control(2, false, now + 250);
    tick(sql, now + 300);
    const released = readKart(sql, q.id)!.drivers[0]!;
    expect(released.sequence).toBe(2);
    expect(released.input.gas).toBe(false);
    // The phone's own checkpoint carries the release too.
    const phone = (await instance.snapshotFor("guest", playerIds[0])).play!.kart!;
    expect(phone.inputCursor).toBe(2);
    expect(phone.rollback?.input.gas).toBe(false);
    // A steady tick: not saved yet, but the next checkpoint saves it.
    expect(stored(sql).drivers[0]!.input.gas).toBe(true);
    expect(checkpointKart(sql)).toBe(1);
    expect(stored(sql).drivers[0]!.sequence).toBe(2);
    expect(stored(sql).drivers[0]!.input.gas).toBe(false);
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const race = readKart(sql, kartQuestion(sql).id)!;
    expect(race.drivers[0]!.sequence).toBe(2);
    expect(race.drivers[0]!.input.gas).toBe(false);
  });
});
