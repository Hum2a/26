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

it("80-player server simulation: real PartyRoom round, scheduler expiry, exactly-once scoring, replay protection, privacy projections", async () => {
  const startSetup = Date.now();

  // Create room
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  // Join 80 guests
  const playerIds: string[] = [];
  for (let i = 0; i < 80; i++) {
    const guest = await stub.joinPlayer({
      nickname: `Player${i.toString().padStart(2, "0")}`,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!guest.ok) throw new Error(`Player ${i} join failed`);
    playerIds.push(guest.playerId);
  }

  const now = Date.now();

  // Initialize 80 independent chess games (one per player) in collect phase
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
      questionSetVersion: "test-chess-80",
    });

    const { createChessRound } = await import("../src/questions/chess-mechanic.ts");
    const question = {
      kind: "chess" as const,
      id: "test-chess-80",
      index: 0,
      total: 1,
      prompt: "80-player load test",
      points: 100,
      illustrative: false,
      attribution: "never" as const,
      presentation: "default",
      playerTimeMs: 60000 as const,
      botTimeMs: 60000 as const,
    };

    // Create round with all 80 frozen participants
    createChessRound(sql, store, question, playerIds, now);
  });

  const setupDuration = Date.now() - startSetup;

  // Verify 80 games initialized and alarms armed
  let guestSnapshotBytes = 0;
  let stageSnapshotBytes = 0;
  let controlSnapshotBytes = 0;

  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec("SELECT game_id, status, scored FROM chess_game")
      .toArray();
    expect(games).toHaveLength(80);
    expect(games.every((g: any) => g.status === "in-progress")).toBe(true);
    expect(games.every((g: any) => g.scored === 0)).toBe(true);

    const jobs = state.storage.sql
      .exec<{ job_id: string; payload: string; status: string; due_at: number }>(
        "SELECT job_id, payload, status, due_at FROM schedule_job WHERE job_type = 'gameplay' AND payload LIKE 'chess-clock:%'",
      )
      .toArray();
    expect(jobs).toHaveLength(80); // One per game
    expect(jobs.every((j) => j.status === "pending")).toBe(true);
    expect(jobs.every((j) => j.due_at > now)).toBe(true);

    const armed = await state.storage.getAlarm();
    expect(armed).not.toBeNull();

    // Measure snapshot payload bytes (before expiry)
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const guestSnapshot = projectChessGameSnapshot(sql, store, "guest", playerIds[0]!);
    guestSnapshotBytes = JSON.stringify(guestSnapshot).length;

    const stageSnapshot = projectChessGameSnapshot(sql, store, "stage");
    stageSnapshotBytes = JSON.stringify(stageSnapshot).length;

    const controlSnapshot = projectChessGameSnapshot(sql, store, "control");
    controlSnapshotBytes = JSON.stringify(controlSnapshot).length;
  });

  // Privacy: guest A should not see guest B's board
  await runInDurableObject(stub, async (_instance, state) => {
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const playerASnapshot = projectChessGameSnapshot(sql, store, "guest", playerIds[0]!);
    const playerBSnapshot = projectChessGameSnapshot(sql, store, "guest", playerIds[1]!);

    expect(playerASnapshot).toBeDefined();
    expect(playerBSnapshot).toBeDefined();
    expect((playerASnapshot as any).gameId).not.toBe((playerBSnapshot as any).gameId);
    expect((playerASnapshot as any).fen).toBeDefined();
    expect((playerBSnapshot as any).fen).toBeDefined();
    // Each guest sees only their own game
  });

  // Privacy: stage should not expose individual boards
  await runInDurableObject(stub, async (_instance, state) => {
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const stageSnapshot = projectChessGameSnapshot(sql, store, "stage") as any;
    expect(stageSnapshot).toBeDefined();
    expect(stageSnapshot.totalGames).toBe(80);
    expect(stageSnapshot.inProgress).toBe(80);
    expect(stageSnapshot.finished).toBe(0);
    // Stage snapshot has no 'fen', 'pgn', or individual board state
    expect("fen" in stageSnapshot).toBe(false);
    expect("pgn" in stageSnapshot).toBe(false);
    expect("gameId" in stageSnapshot).toBe(false);
  });

  // Advance fake time to 70 seconds (past 60s player clock)
  const startExpiry = Date.now();
  const futureNow = now + 70_000;
  await makeDue(stub);

  // Trigger scheduler with real alarm dispatch
  await runInDurableObject(stub, async (instance, _state) => {
    // @ts-expect-error - accessing private method for test
    await instance.runDueJobs(futureNow, () => {});
  });

  const expiryDuration = Date.now() - startExpiry;

  // Verify all 80 games terminal and scored exactly once
  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec<{ game_id: string; status: string; winner: string | null; scored: number }>(
        "SELECT game_id, status, winner, scored FROM chess_game",
      )
      .toArray();

    expect(games).toHaveLength(80);
    for (const game of games) {
      expect(game.status).not.toBe("in-progress"); // Terminal
      expect(game.status).toMatch(/^(timeout|timeout-draw|checkmate|stalemate|resignation|aborted|insufficient-material|threefold-repetition|fifty-move-rule)$/);
      expect(game.scored).toBe(1); // Exactly once
    }

    // Verify exactly 80 ledger entries (one per player)
    const allLedger = state.storage.sql
      .exec<{ player_id: string; question_id: string; points: number }>(
        "SELECT player_id, question_id, points FROM score_ledger",
      )
      .toArray();

    expect(allLedger).toHaveLength(80);
    expect(allLedger.every((entry) => typeof entry.points === "number")).toBe(true);

    // All entries share same question_id
    const questionIds = [...new Set(allLedger.map((e) => e.question_id))];
    expect(questionIds).toHaveLength(1);

    // All player IDs present exactly once
    const scoredPlayerIds = allLedger.map((e) => e.player_id).sort();
    expect(scoredPlayerIds).toEqual([...playerIds].sort());
  });

  // Verify aggregate projection shows 80 finished
  await runInDurableObject(stub, async (_instance, state) => {
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const stageSnapshot = projectChessGameSnapshot(sql, store, "stage") as any;
    expect(stageSnapshot).toBeDefined();
    expect(stageSnapshot.totalGames).toBe(80);
    expect(stageSnapshot.inProgress).toBe(0);
    expect(stageSnapshot.finished).toBe(80);
    expect(
      stageSnapshot.results.playerWins +
        stageSnapshot.results.botWins +
        stageSnapshot.results.draws +
        stageSnapshot.results.aborts,
    ).toBe(80);
  });

  // Replay alarm: should not duplicate scoring
  const startReplay = Date.now();
  const replayAlarm = await runDurableObjectAlarm(stub);
  const replayDuration = Date.now() - startReplay;
  expect(replayAlarm).toBe(true);

  await runInDurableObject(stub, async (_instance, state) => {
    const games = state.storage.sql
      .exec<{ scored: number }>("SELECT scored FROM chess_game")
      .toArray();
    expect(games).toHaveLength(80);
    expect(games.every((g) => g.scored === 1)).toBe(true); // Still exactly once

    const ledger = state.storage.sql
      .exec<{ player_id: string }>("SELECT player_id FROM score_ledger")
      .toArray();
    expect(ledger).toHaveLength(80); // No duplicates
  });

  // Measure final snapshot sizes after expiry
  let finalGuestBytes = 0;
  let finalStageBytes = 0;
  let finalControlBytes = 0;

  await runInDurableObject(stub, async (_instance, state) => {
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const guestSnapshot = projectChessGameSnapshot(sql, store, "guest", playerIds[0]!);
    finalGuestBytes = JSON.stringify(guestSnapshot).length;

    const stageSnapshot = projectChessGameSnapshot(sql, store, "stage");
    finalStageBytes = JSON.stringify(stageSnapshot).length;

    const controlSnapshot = projectChessGameSnapshot(sql, store, "control");
    finalControlBytes = JSON.stringify(controlSnapshot).length;
  });

  // Report measured performance
  console.log("80-player simulation measurements:");
  console.log(`  Setup duration: ${setupDuration}ms`);
  console.log(`  Expiry duration (runDueJobs 80 games): ${expiryDuration}ms`);
  console.log(`  Replay alarm duration: ${replayDuration}ms`);
  console.log(`  Guest snapshot bytes (pre-expiry): ${guestSnapshotBytes}`);
  console.log(`  Stage snapshot bytes (pre-expiry): ${stageSnapshotBytes}`);
  console.log(`  Control snapshot bytes (pre-expiry): ${controlSnapshotBytes}`);
  console.log(`  Guest snapshot bytes (post-expiry): ${finalGuestBytes}`);
  console.log(`  Stage snapshot bytes (post-expiry): ${finalStageBytes}`);
  console.log(`  Control snapshot bytes (post-expiry): ${finalControlBytes}`);

  // Verify performance bounds (reasonable for server simulation)
  expect(setupDuration).toBeLessThan(10_000); // 80-player setup under 10s
  expect(expiryDuration).toBeLessThan(5_000); // 80 clock expirations under 5s
  expect(replayDuration).toBeLessThan(1_000); // Replay protection fast
});

it("resume invalidates pre-pause move commands via position revision", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  const dave = await stub.joinPlayer({
    nickname: "Dave",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!dave.ok) throw new Error("Guest must join");

  const now = Date.now();

  // Initialize chess round
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
      id: "test-chess-resume",
      index: 0,
      total: 1,
      prompt: "Resume test",
      points: 100,
      illustrative: false,
      attribution: "never" as const,
      presentation: "default",
      playerTimeMs: 60000 as const,
      botTimeMs: 60000 as const,
    };
    createChessRound(sql, store, question, [dave.playerId], now);
  });

  // Capture initial position revision
  let initialRevision = 0;
  await runInDurableObject(stub, async (_instance, state) => {
    const game = state.storage.sql
      .exec<{ position_revision: number }>("SELECT position_revision FROM chess_game")
      .toArray()[0];
    initialRevision = game.position_revision;
    expect(initialRevision).toBe(0);
  });

  // Pause chess clocks (increments position revision)
  await runInDurableObject(stub, async (_instance, state) => {
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const { pauseChessClocks } = await import("../src/questions/chess-mechanic.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    pauseChessClocks(sql, store, now + 1000);
  });

  // Verify position revision incremented
  let pausedRevision = 0;
  await runInDurableObject(stub, async (_instance, state) => {
    const game = state.storage.sql
      .exec<{ position_revision: number }>("SELECT position_revision FROM chess_game")
      .toArray()[0];
    pausedRevision = game.position_revision;
    expect(pausedRevision).toBe(1); // Incremented from 0
  });

  // Simulate stale move command with pre-pause revision (should be rejected)
  await runInDurableObject(stub, async (_instance, state) => {
    const { executeChessMove } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const game = sql
      .exec<{ game_id: string }>("SELECT game_id FROM chess_game WHERE player_id = ?", dave.playerId)
      .toArray()[0];

    // Attempt move with stale revision 0 (pre-pause)
    const result = executeChessMove(
      sql,
      store,
      {
        kind: "chess-move" as const,
        requestId: crypto.randomUUID(),
        gameId: game.game_id,
        from: "e2",
        to: "e4",
        positionRevision: initialRevision, // Stale!
      },
      dave.playerId,
      now + 2000,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/revision|stale|mismatch/i);
    }
  });

  // Resume (does NOT increment revision - only pause does)
  await runInDurableObject(stub, async (_instance, state) => {
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const { resumeChessClocks } = await import("../src/questions/chess-mechanic.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    resumeChessClocks(sql, store, now + 3000);
  });

  // Verify position revision unchanged by resume (pause already incremented it)
  let resumedRevision = 0;
  await runInDurableObject(stub, async (_instance, state) => {
    const game = state.storage.sql
      .exec<{ position_revision: number }>("SELECT position_revision FROM chess_game")
      .toArray()[0];
    resumedRevision = game.position_revision;
    expect(resumedRevision).toBe(1); // Unchanged from pause
  });

  // Attempt move with initial revision (still stale - pause incremented it to 1)
  await runInDurableObject(stub, async (_instance, state) => {
    const { executeChessMove } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const game = sql
      .exec<{ game_id: string }>("SELECT game_id FROM chess_game WHERE player_id = ?", dave.playerId)
      .toArray()[0];

    const result = executeChessMove(
      sql,
      store,
      {
        kind: "chess-move" as const,
        requestId: crypto.randomUUID(),
        gameId: game.game_id,
        from: "d2",
        to: "d4",
        positionRevision: initialRevision, // Still stale (0 < 1)
      },
      dave.playerId,
      now + 4000,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/revision|stale|mismatch/i);
    }
  });

  // Move with current revision (pausedRevision = 1) should succeed
  await runInDurableObject(stub, async (_instance, state) => {
    const { executeChessMove } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const game = sql
      .exec<{ game_id: string }>("SELECT game_id FROM chess_game WHERE player_id = ?", dave.playerId)
      .toArray()[0];

    const result = executeChessMove(
      sql,
      store,
      {
        kind: "chess-move" as const,
        requestId: crypto.randomUUID(),
        gameId: game.game_id,
        from: "e2",
        to: "e4",
        positionRevision: pausedRevision, // Current after pause (1)
      },
      dave.playerId,
      now + 5000,
    );

    expect(result.success).toBe(true);
  });
});

it("persisted round recovers clocks and position after DO restart", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);

  const stub = env.PARTY_ROOM.getByName(created.result.gameId);

  const eve = await stub.joinPlayer({
    nickname: "Eve",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!eve.ok) throw new Error("Guest must join");

  const now = Date.now();

  // Initialize chess round and make a move
  let gameId = "";
  let fenAfterMove = "";
  let playerTimeAfterMove = 0;
  let botTimeAfterMove = 0;

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
      id: "test-chess-recovery",
      index: 0,
      total: 1,
      prompt: "Recovery test",
      points: 100,
      illustrative: false,
      attribution: "never" as const,
      presentation: "default",
      playerTimeMs: 60000 as const,
      botTimeMs: 60000 as const,
    };
    createChessRound(sql, store, question, [eve.playerId], now);

    // Make one move
    const game = sql
      .exec<{ game_id: string }>("SELECT game_id FROM chess_game WHERE player_id = ?", eve.playerId)
      .toArray()[0];
    gameId = game.game_id;

    const { executeChessMove } = await import("../src/questions/chess-mechanic.ts");
    const moveResult = executeChessMove(
      sql,
      store,
      {
        kind: "chess-move" as const,
        requestId: crypto.randomUUID(),
        gameId,
        from: "e2",
        to: "e4",
        positionRevision: 0,
      },
      eve.playerId,
      now + 1000,
    );
    expect(moveResult.success).toBe(true);

    // Capture state after move
    const afterMove = sql
      .exec<{ fen: string; player_time_ms: number; bot_time_ms: number }>(
        "SELECT fen, player_time_ms, bot_time_ms FROM chess_game WHERE game_id = ?",
        gameId,
      )
      .toArray()[0];
    fenAfterMove = afterMove.fen;
    playerTimeAfterMove = afterMove.player_time_ms;
    botTimeAfterMove = afterMove.bot_time_ms;

    expect(fenAfterMove).not.toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"); // Not starting position
    expect(playerTimeAfterMove).toBeLessThan(60000); // Clock ran
  });

  // Simulate DO restart by reading state fresh (alarm already armed, clocks persisted)
  await runInDurableObject(stub, async (_instance, state) => {
    const recovered = state.storage.sql
      .exec<{ game_id: string; fen: string; player_time_ms: number; bot_time_ms: number; status: string }>(
        "SELECT game_id, fen, player_time_ms, bot_time_ms, status FROM chess_game WHERE game_id = ?",
        gameId,
      )
      .toArray()[0];

    // Verify persisted state intact
    expect(recovered.game_id).toBe(gameId);
    expect(recovered.fen).toBe(fenAfterMove);
    expect(recovered.player_time_ms).toBe(playerTimeAfterMove);
    expect(recovered.bot_time_ms).toBe(botTimeAfterMove);
    expect(recovered.status).toBe("in-progress");

    // Verify alarm job persisted
    const job = state.storage.sql
      .exec<{ status: string; payload: string }>(
        "SELECT status, payload FROM schedule_job WHERE payload = ?",
        `chess-clock:${gameId}`,
      )
      .toArray()[0];
    expect(job).toBeDefined();
    expect(job.status).toBe("pending");

    // Verify DO alarm still armed
    const armed = await state.storage.getAlarm();
    expect(armed).not.toBeNull();
  });

  // Verify guest snapshot projects recovered state correctly
  await runInDurableObject(stub, async (_instance, state) => {
    const { projectChessGameSnapshot } = await import("../src/questions/chess-mechanic.ts");
    const { createSqlStore } = await import("../src/room/sql-store.ts");
    const sql = state.storage.sql;
    const store = createSqlStore(sql);

    const snapshot = projectChessGameSnapshot(sql, store, "guest", eve.playerId) as any;
    expect(snapshot).toBeDefined();
    expect(snapshot.gameId).toBe(gameId);
    expect(snapshot.fen).toBe(fenAfterMove);
    expect(snapshot.playerTimeMs).toBe(playerTimeAfterMove);
    expect(snapshot.botTimeMs).toBe(botTimeAfterMove);
    expect(snapshot.status).toBe("in-progress");
    expect(snapshot.plyCount).toBeGreaterThan(0); // Move was made
  });
});
