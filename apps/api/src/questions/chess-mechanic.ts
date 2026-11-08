/**
 * Chess round mechanic for PartyRoom integration.
 * Handles SQLite persistence, recovery, and snapshot projection.
 */

import type { ChessQuestion } from "./definition.ts";
import type { GameStore } from "../room/lifecycle.ts";

// D1Database is the Cloudflare D1 SQL storage type
type D1Database = any; // TODO: Import from proper D1 types when wired
import {
  initializeChessRound,
  applyChessMove,
  applyBotMove,
  resignGame,
  calculateChessScore,
  projectGuestSnapshot,
  projectStageSnapshot,
  projectControlSnapshot,
  updateRoundAggregates as updateRoundAggregatesCoordinator,
  type ChessPlayerGame,
  type ChessRoundState,
} from "./chess-coordinator.ts";
import type { ChessMoveCommand, ChessResignCommand } from "@26/shared";

/**
 * Initialize a new chess round in SQLite.
 */
export function createChessRound(
  sql: D1Database,
  store: GameStore,
  _question: ChessQuestion,
  participants: string[],
  now: number,
): void {
  const room = store.readRoom();
  const roundId = `${room.questionSetVersion}-${room.questionIndex}`;

  const state = initializeChessRound(roundId, participants, now);

  // Persist round state
  sql
    .exec(
      `INSERT INTO chess_rounds (round_id, started_at, frozen_participants)
       VALUES (?, ?, ?)`,
    )
    .bind(roundId, state.startedAt, JSON.stringify(state.frozenParticipants))
    .run();

  // Persist all games
  for (const [playerId, game] of Object.entries(state.games)) {
    persistGame(sql, game);
  }

  // Schedule initial clock alarms for all games (all start on player's turn)
  for (const game of Object.values(state.games)) {
    scheduleClockAlarm(sql, store, game.gameId, now + game.playerTimeMs);
  }
}

/**
 * Apply a player move command.
 */
export function executeChessMove(
  sql: D1Database,
  store: GameStore,
  command: ChessMoveCommand,
  playerId: string,
  now: number,
): { success: true; botMoveNeeded: boolean } | { success: false; error: string } {
  // Load game from SQLite
  const game = loadGame(sql, command.gameId);
  if (!game) {
    return { success: false, error: "Game not found" };
  }

  // Verify ownership
  if (game.playerId !== playerId) {
    return { success: false, error: "Not your game" };
  }

  // Apply move through coordinator
  const result = applyChessMove(game, command, now);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  // Persist updated game
  persistGame(sql, result.game);

  // Update round aggregates
  updateRoundAggregates(sql);

  // If game is now terminal, score it
  if (result.game.status !== "in-progress" && result.game.status !== "waiting") {
    scoreGame(sql, result.game);
  } else {
    // Schedule alarm for bot's clock
    scheduleClockAlarm(sql, store, result.game.gameId, now + result.game.botTimeMs);
  }

  return {
    success: true,
    botMoveNeeded: result.game.status === "in-progress" && result.game.sideToMove === "black",
  };
}

/**
 * Apply a bot move (received from client engine with casual trust).
 */
export function executeBotMove(
  sql: D1Database,
  store: GameStore,
  gameId: string,
  move: { from: string; to: string; promotion?: string },
  now: number,
): { success: true } | { success: false; error: string } {
  const game = loadGame(sql, gameId);
  if (!game) {
    return { success: false, error: "Game not found" };
  }

  const result = applyBotMove(game, move, now);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  // Persist updated game
  persistGame(sql, result.game);

  // Update aggregates
  updateRoundAggregates(sql);

  // If terminal, score
  if (result.game.status !== "in-progress" && result.game.status !== "waiting") {
    scoreGame(sql, result.game);
  } else {
    // Schedule alarm for player's clock
    scheduleClockAlarm(sql, store, result.game.gameId, now + result.game.playerTimeMs);
  }

  return { success: true };
}

/**
 * Resign a game.
 */
export function executeResignation(
  sql: D1Database,
  command: ChessResignCommand,
  _playerId: string,
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
  updateRoundAggregates(sql);
  scoreGame(sql, resigned);

  return { success: true };
}

/**
 * Handle clock alarm - check for timeouts.
 */
export async function handleChessClockAlarm(
  sql: D1Database,
  store: GameStore,
  now: number,
): Promise<void> {
  // Find all games with expired alarms
  const stmt = sql.prepare(
    `SELECT game_id FROM chess_clock_alarms WHERE due_at <= ? AND paused_at IS NULL`,
  );
  const expired = stmt.bind(now).all<{ game_id: string }>();

  for (const { game_id } of expired) {
    const game = loadGame(sql, game_id);
    if (!game || game.status !== "in-progress") {
      // Clean up alarm
      sql.exec(`DELETE FROM chess_clock_alarms WHERE game_id = ?`).bind(game_id).run();
      continue;
    }

    // Check if the side to move has flagged
    const elapsed = now - game.lastMoveAt;
    const remainingTime =
      game.sideToMove === game.playerColor
        ? game.playerTimeMs - elapsed
        : game.botTimeMs - elapsed;

    if (remainingTime <= 0) {
      // Timeout!
      const flagged = game.sideToMove === game.playerColor ? "player" : "bot";
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(game.fen);

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
      };

      persistGame(sql, terminatedGame);
      updateRoundAggregates(sql);
      scoreGame(sql, terminatedGame);

      // Remove alarm
      sql.exec(`DELETE FROM chess_clock_alarms WHERE game_id = ?`).bind(game_id).run();
    } else {
      // Not yet flagged, reschedule
      const nextAlarm = game.lastMoveAt + remainingTime;
      sql
        .exec(`UPDATE chess_clock_alarms SET due_at = ? WHERE game_id = ?`)
        .bind(nextAlarm, game_id)
        .run();
    }
  }

  // Schedule next aggregate alarm if any games remain
  const remaining = sql
    .prepare(`SELECT COUNT(*) as count FROM chess_games WHERE status = 'in-progress'`)
    .first<{ count: number }>();

  if (remaining && remaining.count > 0) {
    const nextAlarm = sql
      .prepare(`SELECT MIN(due_at) as next FROM chess_clock_alarms WHERE paused_at IS NULL`)
      .first<{ next: number | null }>();

    if (nextAlarm?.next) {
      // Schedule job for next alarm
      // (This would integrate with PartyRoom's job scheduler)
    }
  }
}

/**
 * Project snapshot for audience.
 */
export function projectChessGameSnapshot(
  sql: D1Database,
  audience: "guest" | "stage" | "control",
  playerId?: string,
): unknown {
  if (audience === "guest") {
    if (!playerId) throw new Error("Guest snapshot requires playerId");
    const game = loadGameByPlayer(sql, playerId);
    if (!game) return null;
    return projectGuestSnapshot(game);
  }

  // Load round state
  const state = loadRoundState(sql);
  if (!state) return null;

  // Build nickname map (would come from room)
  const nicknameMap = new Map<string, string>();
  // TODO: Populate from room.guests

  if (audience === "stage") {
    return projectStageSnapshot(state, nicknameMap);
  }

  return projectControlSnapshot(state, nicknameMap);
}

/**
 * Pause all chess clocks.
 */
export function pauseChessClocks(sql: D1Database, now: number): void {
  // Mark all alarms as paused
  sql.exec(`UPDATE chess_clock_alarms SET paused_at = ?`).bind(now).run();
}

/**
 * Resume all chess clocks.
 */
export function resumeChessClocks(sql: D1Database, store: GameStore, now: number): void {
  // Get all paused alarms
  const stmt = sql.prepare(`SELECT game_id, due_at, paused_at FROM chess_clock_alarms`);
  const paused = stmt.all<{ game_id: string; due_at: number; paused_at: number | null }>();

  for (const alarm of paused) {
    if (alarm.paused_at === null) continue;

    const pauseDuration = now - alarm.paused_at;
    const newDueAt = alarm.due_at + pauseDuration;

    sql
      .exec(`UPDATE chess_clock_alarms SET due_at = ?, paused_at = NULL WHERE game_id = ?`)
      .bind(newDueAt, alarm.game_id)
      .run();
  }
}

/**
 * Force-end all remaining games (abort).
 */
export function forceEndChessRound(sql: D1Database, now: number): void {
  const stmt = sql.prepare(`SELECT game_id FROM chess_games WHERE status = 'in-progress'`);
  const active = stmt.all<{ game_id: string }>();

  for (const { game_id } of active) {
    const game = loadGame(sql, game_id);
    if (!game) continue;

    const aborted: ChessPlayerGame = {
      ...game,
      status: "aborted",
      terminatedAt: now,
      terminationReason: "Host force-ended round",
    };

    persistGame(sql, aborted);
    scoreGame(sql, aborted); // Score 0
  }

  updateRoundAggregates(sql);

  // Clear all alarms
  sql.exec(`DELETE FROM chess_clock_alarms`).run();
}

// Helper functions

function persistGame(sql: D1Database, game: ChessPlayerGame): void {
  sql
    .exec(
      `INSERT OR REPLACE INTO chess_games (
        game_id, round_id, player_id, fen, pgn, position_history,
        player_time_ms, bot_time_ms, last_move_at, side_to_move, ply_count,
        status, winner, terminated_at, termination_reason, scored
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      game.gameId,
      game.gameId.split("-")[0], // Extract roundId
      game.playerId,
      game.fen,
      game.pgn,
      JSON.stringify(game.positionHistory),
      game.playerTimeMs,
      game.botTimeMs,
      game.lastMoveAt,
      game.sideToMove,
      game.plyCount,
      game.status,
      game.winner ?? null,
      game.terminatedAt ?? null,
      game.terminationReason ?? null,
      0, // scored flag
    )
    .run();
}

function loadGame(sql: D1Database, gameId: string): ChessPlayerGame | null {
  const stmt = sql.prepare(`SELECT * FROM chess_games WHERE game_id = ?`);
  const row = stmt.bind(gameId).first<any>();

  if (!row) return null;

  return {
    gameId: row.game_id,
    playerId: row.player_id,
    playerColor: row.player_id, // Always white
    botColor: "black",
    fen: row.fen,
    pgn: row.pgn,
    positionHistory: JSON.parse(row.position_history),
    playerTimeMs: row.player_time_ms,
    botTimeMs: row.bot_time_ms,
    lastMoveAt: row.last_move_at,
    sideToMove: row.side_to_move,
    plyCount: row.ply_count,
    status: row.status,
    winner: row.winner,
    terminatedAt: row.terminated_at,
    terminationReason: row.termination_reason,
  };
}

function loadGameByPlayer(sql: D1Database, playerId: string): ChessPlayerGame | null {
  const stmt = sql.prepare(`SELECT game_id FROM chess_games WHERE player_id = ? ORDER BY last_move_at DESC LIMIT 1`);
  const row = stmt.bind(playerId).first<{ game_id: string }>();
  
  if (!row) return null;
  return loadGame(sql, row.game_id);
}

function loadRoundState(sql: D1Database): ChessRoundState | null {
  const roundStmt = sql.prepare(`SELECT * FROM chess_rounds ORDER BY started_at DESC LIMIT 1`);
  const round = roundStmt.first<any>();

  if (!round) return null;

  const gamesStmt = sql.prepare(`SELECT * FROM chess_games WHERE round_id = ?`);
  const gameRows = gamesStmt.bind(round.round_id).all<any>();

  const games: Record<string, ChessPlayerGame> = {};
  for (const row of gameRows) {
    const game = loadGame(sql, row.game_id);
    if (game) {
      games[game.playerId] = game;
    }
  }

  const state = updateRoundAggregatesCoordinator({
    roundId: round.round_id,
    startedAt: round.started_at,
    frozenParticipants: JSON.parse(round.frozen_participants),
    games,
    gamesInProgress: 0,
    gamesFinished: 0,
    allGamesComplete: false,
  });

  return state;
}

function updateRoundAggregates(_sql: D1Database): void {
  // Aggregates computed on-demand via loadRoundState
  // No persistent aggregate table needed
}

function scoreGame(sql: D1Database, game: ChessPlayerGame): void {
  // Check if already scored
  const existing = sql
    .prepare(`SELECT scored FROM chess_games WHERE game_id = ?`)
    .bind(game.gameId)
    .first<{ scored: number }>();

  if (existing && existing.scored === 1) {
    return; // Already scored
  }

  const score = calculateChessScore(game);

  // Write to ledger (would integrate with room's ledger system)
  // For now, mark as scored
  sql
    .exec(`UPDATE chess_games SET scored = 1 WHERE game_id = ?`)
    .bind(game.gameId)
    .run();

  // TODO: Integrate with room.ledger
}

function scheduleClockAlarm(
  sql: D1Database,
  store: GameStore,
  gameId: string,
  dueAt: number,
): void {
  sql
    .exec(
      `INSERT OR REPLACE INTO chess_clock_alarms (game_id, due_at, paused_at)
       VALUES (?, ?, NULL)`,
    )
    .bind(gameId, dueAt)
    .run();

  // TODO: Integrate with PartyRoom's job scheduler to wake at dueAt
}

function hasMateMaterial(chess: any, color: "w" | "b"): boolean {
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
