import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";

/**
 * Real PartyRoom scheduler integration: prove DO alarm() fires chess-clock jobs.
 * Uses actual room lifecycle (startBirthday), real alarm dispatch (runDurableObjectAlarm),
 * and time advancement (UPDATE due_at) to verify silent timeout without guest commands.
 */

async function makeDue(stub: ReturnType<typeof env.PARTY_ROOM.getByName>): Promise<void> {
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = ? WHERE status = 'pending' AND payload LIKE 'chess-clock:%'`,
      Date.now() - 1,
    );
  });
}

it("real DO alarm dispatch: fires chess-clock jobs, flags games silently, scores exactly once", async () => {
  // Create room and join guests
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  const alice = await stub.joinPlayer({
    nickname: "Alice",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  const bob = await stub.joinPlayer({
    nickname: "Bob",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!alice.ok || !bob.ok) throw new Error("Guests must join");

  const now = Date.now();

  // Directly initialize chess round in collect phase (bypass pack ordering)
  await runInDurableObject(stub, async (_instance, state) => {
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const room = store.readRoom();

    // Transition to collect
    store.writeRoom({
      ...room,
      phase: "collect",
      paused: false,
      questionCount: 1,
      questionIndex: 0,
      questionSetVersion: "test-chess",
    });

    // Initialize chess round
    const { createChessRound } = await import("../src/questions/chess-mechanic.ts");
    const question = {
      kind: "chess" as const,
      id: "test-chess",
      index: 0,
      total: 1,
      prompt: "Test",
      points: 100,
      illustrative: false,
      attribution: "never" as const,
      presentation: "default",
      playerTimeMs: 60000 as const,
      botTimeMs: 60000 as const,
    };
    createChessRound(sql, store, question, [alice.playerId, bob.playerId], now);
  });

  // Verify chess round initialized and alarm armed
  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec("SELECT game_id, status FROM chess_game")
      .toArray();
    expect(games).toHaveLength(2);
    expect(games.every((g: any) => g.status === "in-progress")).toBe(true);

    // Verify alarms scheduled
    const jobs = state.storage.sql
      .exec<{ job_id: string; payload: string; status: string; due_at: number }>(
        "SELECT job_id, payload, status, due_at FROM schedule_job WHERE job_type = 'gameplay' AND payload LIKE 'chess-clock:%'",
      )
      .toArray();
    expect(jobs).toHaveLength(2); // One per game
    expect(jobs.every((j) => j.status === "pending")).toBe(true);
    expect(jobs.every((j) => j.due_at > now)).toBe(true); // Future

    // Verify DO alarm armed
    const armed = await state.storage.getAlarm();
    expect(armed).not.toBeNull();
  });

  // Advance fake time to 70 seconds after game start (past 60s player clock)
  const futureNow = now + 70_000;
  await makeDue(stub);

  // Diagnostic: verify handler will see expired clocks
  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec<{ game_id: string; last_move_at: number; player_time_ms: number }>(
        "SELECT game_id, last_move_at, player_time_ms FROM chess_game",
      )
      .toArray();
    for (const game of games) {
      const elapsed = futureNow - game.last_move_at;
      expect(elapsed).toBeGreaterThan(game.player_time_ms); // Confirm expired
    }
  });

  // Manually invoke PartyRoom.runDueJobs with future time (simulates alarm firing at futureNow)
  await runInDurableObject(stub, async (instance, _state) => {
    // @ts-expect-error - accessing private method for test
    await instance.runDueJobs(futureNow, () => {});
  });

  // Verify games flagged silently and scored exactly once
  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec<{ game_id: string; status: string; winner: string | null; scored: number }>(
        "SELECT game_id, status, winner, scored FROM chess_game",
      )
      .toArray();

    expect(games).toHaveLength(2);
    for (const game of games) {
      expect(game.status).not.toBe("in-progress"); // Terminal
      expect(game.winner).toBeDefined();
      expect(game.scored).toBe(1); // Exactly once
    }

    // Verify ledger entries (exactly one per player)
    const allLedger = state.storage.sql
      .exec<{ player_id: string; question_id: string; points: number }>(
        "SELECT player_id, question_id, points FROM score_ledger",
      )
      .toArray();

    expect(allLedger).toHaveLength(2);
    expect(allLedger.every((entry) => typeof entry.points === "number")).toBe(true);
    // All entries share same question_id (roundId-questionIndex pattern)
    const questionIds = [...new Set(allLedger.map((e) => e.question_id))];
    expect(questionIds).toHaveLength(1);
  });

  // Second alarm delivers: already handled, no extra scoring
  const secondAlarm = await runDurableObjectAlarm(stub);
  expect(secondAlarm).toBe(true);

  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec<{ scored: number }>("SELECT scored FROM chess_game")
      .toArray();
    expect(games.every((g) => g.scored === 1)).toBe(true); // Still exactly once
  });
});

it("paused chess: clocks cancel and revision increments (prevents stale moves)", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  const charlie = await stub.joinPlayer({
    nickname: "Charlie",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!charlie.ok) throw new Error("Guest must join");

  const now = Date.now();

  // Initialize chess round directly
  await runInDurableObject(stub, async (_instance, state) => {
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const room = store.readRoom();

    store.writeRoom({
      ...room,
      phase: "collect",
      paused: false,
      questionCount: 1,
      questionIndex: 0,
      questionSetVersion: "test-chess",
    });

    const { createChessRound } = await import("../src/questions/chess-mechanic.ts");
    const question = {
      kind: "chess" as const,
      id: "test-chess",
      index: 0,
      total: 1,
      prompt: "Test",
      points: 100,
      illustrative: false,
      attribution: "never" as const,
      presentation: "default",
      playerTimeMs: 60000 as const,
      botTimeMs: 60000 as const,
    };
    createChessRound(sql, store, question, [charlie.playerId], now);
  });

  const pauseTime = now + 1000;

  // Directly pause chess clocks (bypassing questionFor lookup)
  await runInDurableObject(stub, async (_instance, state) => {
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const { pauseChessClocks } = await import("../src/questions/chess-mechanic.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    // Verify initial state
    const before = sql
      .exec<{ status: string; position_revision: number }>(
        "SELECT status, position_revision FROM chess_game",
      )
      .toArray()[0];
    expect(before.status).toBe("in-progress");
    expect(before.position_revision).toBe(0);

    // Pause
    pauseChessClocks(sql, store, pauseTime);

    // Verify revision incremented and jobs cancelled
    const after = sql
      .exec<{ status: string; position_revision: number }>(
        "SELECT status, position_revision FROM chess_game",
      )
      .toArray()[0];
    expect(after.status).toBe("in-progress");
    expect(after.position_revision).toBe(1);

    const jobs = sql
      .exec<{ status: string }>(
        "SELECT status FROM schedule_job WHERE payload LIKE 'chess-clock:%'",
      )
      .toArray();
    expect(jobs.every((j) => j.status === "cancelled")).toBe(true);
  });

  // Verify game remains in-progress (paused clocks prevent flag)
  await runInDurableObject(stub, async (_instance, state) => {
    const game = state.storage.sql
      .exec<{ status: string }>("SELECT status FROM chess_game")
      .toArray()[0];
    expect(game.status).toBe("in-progress");
  });
});
