/**
 * Chess round mechanic for PartyRoom integration.
 * Handles game initialization, move processing, clock alarms, and scoring.
 */

import type { GameStore } from "../room/lifecycle.ts";
import {
  initializeChessRound,
  applyChessMove,
  applyBotMove,
  resignGame,
  calculateChessScore,
  projectGuestSnapshot,
  projectStageSnapshot,
  projectControlSnapshot,
  type ChessPlayerGame,
  type ChessRoundState,
} from "./chess-coordinator.ts";
import type { ChessMoveCommand, ChessResignCommand } from "@26/shared";
import { Chess, type Chess as ChessInstance } from "chess.js";

// Re-export projection functions for test and integration use
export { projectGuestSnapshot, projectStageSnapshot, projectControlSnapshot };

/**
 * Initialize a new chess round in SQLite and schedule clock alarms.
 */
export function createChessRound(
  sql: SqlStorage,
  store: GameStore,
  _question: { kind: "chess" },
  participants: string[],
  now: number,
  playerTimeMsOverride: number = 60000,
  botTimeMsOverride: number = 60000,
): void {
  const room = store.readRoom();
  const roundId = `${room.questionSetVersion}-${room.questionIndex}`;

  const state = initializeChessRound(
    roundId,
    participants,
    now,
    playerTimeMsOverride,
    botTimeMsOverride,
  );

  // Persist all games
  for (const game of Object.values(state.games)) {
    persistGame(sql, game);
  }

  // Schedule initial clock alarms for all games (all start on player's turn)
  for (const game of Object.values(state.games)) {
    scheduleClockAlarm(store, game.gameId, now + game.playerTimeMs, room.phaseGeneration, room.scopeGeneration);
  }
}

/**
 * Apply a player move command.
 */
export function executeChessMove(
  sql: SqlStorage,
  store: GameStore,
  command: ChessMoveCommand,
  playerId: string,
  now: number,
): { success: true } | { success: false; error: string } {
  // Load game from SQLite
  const game = loadGame(sql, command.gameId);
  if (!game) {
    return { success: false, error: "Game not found" };
  }

  // CRITICAL: Verify ownership FIRST - player can ONLY move in their OWN game
  if (game.playerId !== playerId) {
    return { success: false, error: "Not your game" };
  }

  // Determine if this is a human or bot move from game state
  // Human move: it's the player's turn (sideToMove === playerColor)
  // Bot move: it's the bot's turn (sideToMove === botColor)
  const isHumanTurn = game.sideToMove === game.playerColor;

  // Validate position revision BEFORE either branch (human or bot)
  if (command.positionRevision !== game.positionRevision) {
    return { 
      success: false, 
      error: `Position revision mismatch: expected ${game.positionRevision}, got ${command.positionRevision}` 
    };
  }

  if (isHumanTurn) {
    // Human move: apply through coordinator
    const result = applyChessMove(game, command, now);
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    persistGame(sql, result.game);
    if (result.game.status !== "in-progress") {
      scoreGameOnce(sql, result.game);
    } else {
      // Schedule alarm for bot's clock
      const room = store.readRoom();
      scheduleClockAlarm(store, result.game.gameId, now + result.game.botTimeMs, room.phaseGeneration, room.scopeGeneration);
    }
    return { success: true };
  } else {
    // Bot move: apply through bot coordinator
    const result = applyBotMove(
      game,
      { from: command.from, to: command.to, promotion: command.promotion },
      now
    );
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    persistGame(sql, result.game);
    if (result.game.status !== "in-progress") {
      scoreGameOnce(sql, result.game);
    } else {
      // Schedule alarm for player's clock
      const room = store.readRoom();
      scheduleClockAlarm(store, result.game.gameId, now + result.game.playerTimeMs, room.phaseGeneration, room.scopeGeneration);
    }
    return { success: true };
  }
}

/**
 * Apply a bot move (received from client engine with casual trust).
 * Bot moves MUST also validate positionRevision - casual trust doesn't excuse stale commands.
 */
export function executeBotMove(
  sql: SqlStorage,
  store: GameStore,
  gameId: string,
  move: { from: string; to: string; promotion?: string },
  positionRevision: number,
  now: number,
): { success: true } | { success: false; error: string } {
  const game = loadGame(sql, gameId);
  if (!game) {
    return { success: false, error: "Game not found" };
  }

  // CRITICAL: Validate position revision before applying bot move
  if (positionRevision !== game.positionRevision) {
    return { success: false, error: `Bot position revision mismatch: expected ${game.positionRevision}, got ${positionRevision}` };
  }

  const result = applyBotMove(game, move, now);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  // Persist updated game
  persistGame(sql, result.game);

  // If terminal, score
  if (result.game.status !== "in-progress") {
    scoreGameOnce(sql, result.game);
  } else {
    // Schedule alarm for player's clock
    const room = store.readRoom();
    scheduleClockAlarm(store, result.game.gameId, now + result.game.playerTimeMs, room.phaseGeneration, room.scopeGeneration);
  }

  return { success: true };
}

/**
 * Resign a game.
 */
export function executeResignation(
  sql: SqlStorage,
  command: ChessResignCommand,
  playerId: string,
  now: number,
): { success: true } | { success: false; error: string } {
  const game = loadGame(sql, command.gameId);
  if (!game) {
    return { success: false, error: "Game not found" };
  }

  if (game.playerId !== playerId) {
    return { success: false, error: "Not your game" };
  }

  const resigned = resignGame(game, now);
  persistGame(sql, resigned);
  scoreGameOnce(sql, resigned);

  return { success: true };
}

/**
 * Handle clock alarm - check for timeouts when alarm fires.
 * Called from PartyRoom onAlarm when chess-clock job is due.
 * Must be synchronous for SQLite transaction compatibility.
 */
export function handleChessClockAlarm(
  sql: SqlStorage,
  _store: GameStore,
  gameId: string,
  now: number,
): void {
  const game = loadGame(sql, gameId);
  if (!game || game.status !== "in-progress") {
    return;
  }

  // Check if the side to move has flagged
  const elapsed = now - game.lastMoveAt;
  const remainingTime =
    game.sideToMove === "white"
      ? game.playerTimeMs - elapsed
      : game.botTimeMs - elapsed;

  if (remainingTime <= 0) {
    // Timeout!
    const flagged = game.sideToMove === "white" ? "player" : "bot";
    const chess = new Chess();
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    } else {
      chess.load(game.fen);
    }

    // Check if opponent can mate
    const canMate = hasMateMaterial(chess, flagged === "player" ? "b" : "w");

    const terminatedGame: ChessPlayerGame = {
      ...game,
      status: canMate ? "timeout" : "timeout-draw",
      winner: canMate ? (flagged === "player" ? "bot" : "player") : "draw",
      playerTimeMs: flagged === "player" ? 0 : game.playerTimeMs,
      botTimeMs: flagged === "bot" ? 0 : game.botTimeMs,
      terminatedAt: now,
      terminationReason: canMate
        ? `${flagged === "player" ? "Player" : "Bot"} ran out of time`
        : `${flagged === "player" ? "Player" : "Bot"} flagged but opponent cannot mate - draw`,
      positionRevision: game.positionRevision + 1,
    };

    persistGame(sql, terminatedGame);
    scoreGameOnce(sql, terminatedGame);
  }
}

/**
 * Project snapshot for audience.
 */
export function projectChessGameSnapshot(
  sql: SqlStorage,
  store: GameStore,
  audience: "guest" | "stage" | "control",
  playerId?: string,
): unknown {
  if (audience === "guest") {
    if (!playerId) throw new Error("Guest snapshot requires playerId");
    const game = loadGameByPlayer(sql, playerId);
    if (!game) return null;
    const room = store.readRoom();
    return projectGuestSnapshot(game, room.paused);
  }

  // Load round state
  const state = loadRoundState(sql);
  if (!state) return null;

  // Build nickname map from room
  const nicknameMap = buildNicknameMap(sql);

  if (audience === "stage") {
    return projectStageSnapshot(state, nicknameMap);
  }

  return projectControlSnapshot(state, nicknameMap);
}

/**
 * Pause all chess clocks and increment position revision.
 * Settles active elapsed time at pause moment, freezing clock state.
 * This invalidates all in-flight client state (including bot engine calculations).
 */
export function pauseChessClocks(sql: SqlStorage, store: GameStore, now: number): void {
  const games = sql
    .exec<{ 
      game_id: string; 
      position_revision: number;
      last_move_at: number;
      side_to_move: string;
      player_time_ms: number;
      bot_time_ms: number;
    }>(
      `SELECT game_id, position_revision, last_move_at, side_to_move, player_time_ms, bot_time_ms 
       FROM chess_game WHERE status = 'in-progress'`,
    )
    .toArray();

  for (const game of games) {
    // Settle elapsed time at pause moment
    const elapsed = now - game.last_move_at;
    const newPlayerTime = game.side_to_move === "white" 
      ? game.player_time_ms - elapsed 
      : game.player_time_ms;
    const newBotTime = game.side_to_move === "black" 
      ? game.bot_time_ms - elapsed 
      : game.bot_time_ms;

    // Update: freeze clocks, increment revision, set last_move_at to pause time
    sql.exec(
      `UPDATE chess_game 
       SET position_revision = ?,
           player_time_ms = ?,
           bot_time_ms = ?,
           last_move_at = ?
       WHERE game_id = ?`,
      game.position_revision + 1,
      Math.max(0, newPlayerTime),
      Math.max(0, newBotTime),
      now,
      game.game_id,
    );
  }

  // Cancel all pending clock alarms
  const room = store.readRoom();
  const jobs = store.jobs().filter((job: { payload: string; status: string; phaseGeneration: number }) => 
    job.payload.startsWith("chess-clock:") &&
    job.status === "pending" &&
    job.phaseGeneration === room.phaseGeneration
  );

  for (const job of jobs) {
    store.saveJob({ ...job, status: "cancelled", dueAt: null, remainingMs: null });
  }
}

/**
 * Resume all chess clocks.
 * Uses frozen clock values from pause, excludes paused duration.
 * Sets last_move_at to resume time and reschedules alarms.
 */
export function resumeChessClocks(sql: SqlStorage, store: GameStore, now: number): void {
  const games = sql
    .exec<{ game_id: string; side_to_move: string; player_time_ms: number; bot_time_ms: number }>(
      `SELECT game_id, side_to_move, player_time_ms, bot_time_ms FROM chess_game WHERE status = 'in-progress'`,
    )
    .toArray();

  const room = store.readRoom();

  for (const game of games) {
    // Set last_move_at to resume time (excludes paused duration)
    sql.exec(
      `UPDATE chess_game SET last_move_at = ? WHERE game_id = ?`,
      now,
      game.game_id,
    );

    // Use frozen clock values from pause
    const remainingTime =
      game.side_to_move === "white"
        ? game.player_time_ms
        : game.bot_time_ms;

    if (remainingTime > 0) {
      scheduleClockAlarm(store, game.game_id, now + remainingTime, room.phaseGeneration, room.scopeGeneration);
    } else {
      // Clock already expired during pause - flag immediately
      const { handleChessClockAlarm } = require("./chess-mechanic.ts");
      handleChessClockAlarm(sql, store, game.game_id, now);
    }
  }
}

/**
 * Force-end all remaining games (abort, score 0).
 */
export function forceEndChessRound(sql: SqlStorage, now: number): void {
  const active = sql
    .exec<{ game_id: string }>(`SELECT game_id FROM chess_game WHERE status = 'in-progress'`)
    .toArray();

  for (const { game_id } of active) {
    const game = loadGame(sql, game_id);
    if (!game) continue;

    const aborted: ChessPlayerGame = {
      ...game,
      status: "aborted",
      terminatedAt: now,
      terminationReason: "Host force-ended round",
      positionRevision: game.positionRevision + 1,
    };

    persistGame(sql, aborted);
    scoreGameOnce(sql, aborted); // Score 0
  }
}

// Helper functions

function persistGame(sql: SqlStorage, game: ChessPlayerGame): void {
  sql.exec(
    `INSERT OR REPLACE INTO chess_game (
      game_id, round_id, player_id, fen, pgn, position_history,
      player_time_ms, bot_time_ms, last_move_at, side_to_move, ply_count, position_revision,
      status, winner, terminated_at, termination_reason, scored
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    game.gameId,
    game.gameId.slice(0, game.gameId.length - game.playerId.length - 1), // Extract roundId
    game.playerId,
    game.fen,
    game.pgn,
    JSON.stringify(game.positionHistory),
    game.playerTimeMs,
    game.botTimeMs,
    game.lastMoveAt,
    game.sideToMove,
    game.plyCount,
    game.positionRevision,
    game.status,
    game.winner ?? null,
    game.terminatedAt ?? null,
    game.terminationReason ?? null,
    0, // scored flag
  );
}

interface ChessGameRow {
  game_id: string;
  round_id: string;
  player_id: string;
  fen: string;
  pgn: string;
  position_history: string;
  player_time_ms: number;
  bot_time_ms: number;
  last_move_at: number;
  side_to_move: string;
  ply_count: number;
  position_revision: number;
  status: string;
  winner: string | null;
  terminated_at: number | null;
  termination_reason: string | null;
  scored: number;
}

function loadGame(sql: SqlStorage, gameId: string): ChessPlayerGame | null {
  const row = sql.exec(`SELECT * FROM chess_game WHERE game_id = ?`, gameId).toArray()[0] as unknown as ChessGameRow | undefined;

  if (!row) return null;

  return {
    gameId: row.game_id,
    playerId: row.player_id,
    playerColor: "white",
    botColor: "black",
    fen: row.fen,
    pgn: row.pgn,
    positionHistory: JSON.parse(row.position_history),
    playerTimeMs: row.player_time_ms,
    botTimeMs: row.bot_time_ms,
    lastMoveAt: row.last_move_at,
    sideToMove: row.side_to_move as "white" | "black",
    plyCount: row.ply_count,
    positionRevision: row.position_revision,
    status: row.status as "waiting" | "in-progress" | "checkmate" | "stalemate" | "insufficient-material" | "threefold-repetition" | "fifty-move-rule" | "timeout" | "timeout-draw" | "resignation" | "aborted",
    winner: (row.winner as "player" | "bot" | "draw" | null) ?? undefined,
    terminatedAt: row.terminated_at ?? undefined,
    terminationReason: row.termination_reason ?? undefined,
  };
}

function loadGameByPlayer(sql: SqlStorage, playerId: string): ChessPlayerGame | null {
  const row = sql
    .exec<{ game_id: string }>(
      `SELECT game_id FROM chess_game WHERE player_id = ? ORDER BY last_move_at DESC LIMIT 1`,
      playerId,
    )
    .toArray()[0];

  if (!row) return null;
  return loadGame(sql, row.game_id);
}

function loadRoundState(sql: SqlStorage): ChessRoundState | null {
  // Chess round state is reconstructed from chess_game rows
  const gameRows = sql
    .exec(`SELECT * FROM chess_game ORDER BY game_id`)
    .toArray() as unknown as ChessGameRow[];

  if (gameRows.length === 0) return null;

  const games: Record<string, ChessPlayerGame> = {};
  let roundId = "";
  const participants = new Set<string>();

  for (const row of gameRows) {
    const game = loadGame(sql, row.game_id);
    if (game) {
      games[game.playerId] = game;
      participants.add(game.playerId);
      if (!roundId) roundId = game.gameId.split("-")[0];
    }
  }

  const inProgress = gameRows.filter((r) => r.status === "in-progress").length;
  const finished = gameRows.length - inProgress;

  return {
    roundId,
    startedAt: Math.min(...gameRows.map((r) => r.last_move_at)),
    frozenParticipants: Array.from(participants),
    games,
    gamesInProgress: inProgress,
    gamesFinished: finished,
    allGamesComplete: inProgress === 0,
  };
}

function scoreGameOnce(sql: SqlStorage, game: ChessPlayerGame): void {
  // Check if already scored
  const existing = sql
    .exec<{ scored: number }>(`SELECT scored FROM chess_game WHERE game_id = ?`, game.gameId)
    .toArray()[0];

  if (existing && existing.scored === 1) {
    return; // Already scored
  }

  const score = calculateChessScore(game);

  // Write to score_ledger (exactly once)
  const questionId = game.gameId.split("-")[0];
  sql.exec(
    `INSERT INTO score_ledger (question_id, player_id, points, detail, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (question_id, player_id) DO NOTHING`,
    questionId,
    game.playerId,
    score,
    JSON.stringify({ result: game.winner, status: game.status }),
    Date.now(),
  );

  // Mark as scored
  sql.exec(`UPDATE chess_game SET scored = 1 WHERE game_id = ?`, game.gameId);
}

function scheduleClockAlarm(
  store: GameStore,
  gameId: string,
  dueAt: number,
  phaseGeneration: number,
  scopeGeneration: number,
): void {
  const jobId = `chess-clock:${gameId}`;
  const room = store.readRoom();
  
  store.saveJob({
    jobId,
    jobType: "gameplay",
    dueAt,
    remainingMs: null,
    scopeGeneration,
    phaseGeneration,
    phase: room.phase,
    status: "pending",
    retryCount: 0,
    payload: jobId,
    createdAt: Date.now(),
  });
}

function buildNicknameMap(sql: SqlStorage): Map<string, string> {
  const rows = sql
    .exec<{ player_id: string; nickname: string }>(
      `SELECT player_id, nickname FROM player WHERE revoked_at IS NULL`,
    )
    .toArray();

  return new Map(rows.map((r) => [r.player_id, r.nickname]));
}

function hasMateMaterial(chess: ChessInstance, color: "w" | "b"): boolean {
  const board = chess.board();
  let queens = 0;
  let rooks = 0;
  let bishops = 0;
  let knights = 0;
  let pawns = 0;

  for (const row of board) {
    for (const square of row) {
      if (square && square.color === color) {
        switch (square.type) {
          case "q":
            queens++;
            break;
          case "r":
            rooks++;
            break;
          case "b":
            bishops++;
            break;
          case "n":
            knights++;
            break;
          case "p":
            pawns++;
            break;
        }
      }
    }
  }

  if (queens > 0 || rooks > 0 || pawns > 0) return true;
  if (bishops >= 2) return true;
  if (bishops >= 1 && knights >= 1) return true;
  if (knights >= 2) return true;
  return false;
}
