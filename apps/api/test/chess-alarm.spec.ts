import { env, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";

/**
 * Mechanic-level tests: manual handleChessClockAlarm invocation.
 * These verify the chess coordinator logic but do NOT prove scheduler dispatch.
 * See chess-scheduler.spec.ts for real DO alarm() integration tests.
 */
it("mechanic: handleChessClockAlarm flags games and scores exactly once", async () => {
  // Create room
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  // Join two guests
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

  // Use chess question directly (literals required by schema)
  const question = {
    kind: "chess" as const,
    id: "test-chess",
    index: 0,
    total: 1,
    prompt: "Test chess",
    points: 100,
    illustrative: false,
    attribution: "never" as const,
    presentation: "default",
    playerTimeMs: 60000 as const,
    botTimeMs: 60000 as const,
  };

  const now = Date.now();

  // Bootstrap room into collect phase with chess round
  await runInDurableObject(stub, async (_instance, state) => {
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
      questionSetVersion: "test-version",
    });

    // Initialize chess round with very short clocks for test (100ms)
    const { createChessRound } =
      await import("../src/questions/chess/chess-mechanic.ts");
    const participants = [alice.playerId, bob.playerId];

    // Override question times - pass directly to createChessRound
    createChessRound(sql, store, question, participants, now, 100, 60000);

    // Verify games created
    const games = sql
      .exec<{ game_id: string; player_id: string; status: string }>(
        "SELECT game_id, player_id, status FROM chess_game",
      )
      .toArray();
    expect(games).toHaveLength(2);
    expect(games.every((g) => g.status === "in-progress")).toBe(true);

    // Verify alarms scheduled - check dueAt
    const jobs = sql
      .exec<{ job_id: string; payload: string; status: string; due_at: number }>(
        "SELECT job_id, payload, status, due_at FROM schedule_job WHERE job_type = 'gameplay'",
      )
      .toArray();
    expect(jobs.some((j) => j.payload.startsWith("chess-clock:"))).toBe(true);
  });

  // Wait and manually trigger clock alarms directly
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Manually invoke clock alarm handler at future time
  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const { handleChessClockAlarm } =
      await import("../src/questions/chess/chess-mechanic.ts");

    // Get game details for debugging
    const before = sql
      .exec<{
        game_id: string;
        status: string;
        player_time_ms: number;
        bot_time_ms: number;
        last_move_at: number;
      }>(
        "SELECT game_id, status, player_time_ms, bot_time_ms, last_move_at FROM chess_game",
      )
      .toArray();

    const futureTime = now + 200; // Past the 100ms player clock
    for (const game of before) {
      if (game.status === "in-progress") {
        await handleChessClockAlarm(sql, store, game.game_id, futureTime);
      }
    }

    // Check if games changed
    const after = sql
      .exec<{ game_id: string; status: string }>(
        "SELECT game_id, status FROM chess_game",
      )
      .toArray();

    if (after.every((g) => g.status === "in-progress")) {
      throw new Error(
        `Alarm handler did not flag games. Before: ${JSON.stringify(before)}, after: ${JSON.stringify(after)}, futureTime: ${futureTime}`,
      );
    }
  });

  // Verify games flagged and scored exactly once
  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql;

    // Check game status
    const games = sql
      .exec<{ game_id: string; status: string; winner: string | null; scored: number }>(
        "SELECT game_id, status, winner, scored FROM chess_game",
      )
      .toArray();

    expect(games).toHaveLength(2);
    for (const game of games) {
      expect(game.status).not.toBe("in-progress");
      expect(game.winner).toBeDefined();
      expect(game.scored).toBe(1); // Exactly once
    }

    // Verify ledger entries (exactly one per player)
    const ledger = sql
      .exec<{ player_id: string; points: number; question_id: string }>(
        "SELECT player_id, points, question_id FROM score_ledger",
      )
      .toArray();

    expect(ledger).toHaveLength(2); // One per player
    expect(ledger.every((entry) => typeof entry.points === "number")).toBe(true);
    // Question ID from roundId - all entries share same questionId
    const questionIds = [...new Set(ledger.map((e) => e.question_id))];
    expect(questionIds).toHaveLength(1);
  });
});

it("mechanic: paused clock increments revision, handler respects cancellation", async () => {
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

  const question = {
    kind: "chess" as const,
    id: "pause-chess",
    index: 0,
    total: 1,
    prompt: "Test chess",
    points: 100,
    illustrative: false,
    attribution: "never" as const,
    presentation: "default",
    playerTimeMs: 60000 as const,
    botTimeMs: 60000 as const,
  };

  const now = Date.now();

  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    const room = store.readRoom();

    store.writeRoom({
      ...room,
      phase: "collect",
      paused: false,
      questionCount: 1,
      questionIndex: 0,
      roundId: "pause-round",
    });

    const { createChessRound } =
      await import("../src/questions/chess/chess-mechanic.ts");
    createChessRound(sql, store, question, [charlie.playerId], now, 500, 60000);

    // Get initial revision
    const before = sql
      .exec<{ position_revision: number }>(
        "SELECT position_revision FROM chess_game WHERE player_id = ?",
        charlie.playerId,
      )
      .toArray()[0];

    // Pause
    const { pauseChessClocks } =
      await import("../src/questions/chess/chess-mechanic.ts");
    pauseChessClocks(sql, store, now);

    // Verify revision incremented
    const after = sql
      .exec<{ position_revision: number }>(
        "SELECT position_revision FROM chess_game WHERE player_id = ?",
        charlie.playerId,
      )
      .toArray()[0];

    expect(after.position_revision).toBe(before.position_revision + 1);

    // Verify jobs cancelled
    const jobs = sql
      .exec<{ status: string }>(
        "SELECT status FROM schedule_job WHERE payload LIKE 'chess-clock:%'",
      )
      .toArray();
    expect(jobs.every((j) => j.status === "cancelled")).toBe(true);
  });

  // Wait beyond original alarm time
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Verify still in progress (not flagged)
  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql;
    const game = sql
      .exec<{ status: string }>(
        "SELECT status FROM chess_game WHERE player_id = ?",
        charlie.playerId,
      )
      .toArray()[0];

    expect(game.status).toBe("in-progress");
  });
});
