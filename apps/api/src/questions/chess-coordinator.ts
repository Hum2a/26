/**
 * Chess round coordinator: server-authoritative game state, move validation, clock management.
 * Uses chess.js for complete chess rules (castling, en passant, promotion, draws, checkmate).
 */

import { Chess } from "chess.js";
import type {
  ChessGuestSnapshot,
  ChessStageSnapshot,
  ChessControlSnapshot,
  ChessMoveCommand,
  ChessGameStatus,
  ChessPlayerGame,
  ChessRoundState,
} from "@26/shared";

export type { ChessPlayerGame, ChessRoundState } from "@26/shared";

/**
 * Initialize a new chess round for all active participants.
 */
export function initializeChessRound(
  roundId: string,
  participantIds: string[],
  now: number,
): ChessRoundState {
  const games: Record<string, ChessPlayerGame> = {};

  for (const playerId of participantIds) {
    const gameId = `${roundId}-${playerId}`;
    const chess = new Chess();

    games[playerId] = {
      gameId,
      playerId,
      playerColor: "white", // All guests play White
      botColor: "black",
      fen: chess.fen(),
      pgn: "",
      status: "in-progress",
      playerTimeMs: 60_000, // 1+0: 60 seconds
      botTimeMs: 60_000,
      lastMoveAt: now,
      positionHistory: [chess.fen()],
      sideToMove: "white",
      plyCount: 0,
      positionRevision: 0, // Incremented on every position change (move/pause/resume)
    };
  }

  return {
    roundId,
    startedAt: now,
    frozenParticipants: [...participantIds],
    games,
    gamesInProgress: participantIds.length,
    gamesFinished: 0,
    allGamesComplete: false,
  };
}

/**
 * Apply a guest move command. Returns updated game or error.
 */
export function applyChessMove(
  game: ChessPlayerGame,
  command: ChessMoveCommand,
  now: number,
): { game: ChessPlayerGame } | { error: string } {
  // Validate game ownership
  if (command.gameId !== game.gameId) {
    return { error: "Game ID mismatch" };
  }

  // Validate position revision - reject stale moves from old position
  if (command.positionRevision !== game.positionRevision) {
    return { error: `Position revision mismatch: expected ${game.positionRevision}, got ${command.positionRevision}` };
  }

  // Check game is in progress
  if (game.status !== "in-progress") {
    return { error: "Game is not in progress" };
  }

  // Check it's the player's turn
  if (game.sideToMove !== game.playerColor) {
    return { error: "Not your turn" };
  }

  // Check player hasn't flagged
  const elapsed = now - game.lastMoveAt;
  const playerTimeRemaining = game.playerTimeMs - elapsed;
  if (playerTimeRemaining <= 0) {
    // Player flagged
    return applyTimeout(game, "player", now);
  }

  // Rehydrate chess instance with full history for repetition detection
  const chess = new Chess();
  // Load moves from PGN to rebuild history
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  } else {
    // Initial position - load FEN
    chess.load(game.fen);
  }

  // Apply the new move
  try {
    const move = chess.move({
      from: command.from,
      to: command.to,
      promotion: command.promotion,
    });

    if (!move) {
      return { error: "Illegal move" };
    }
  } catch (e) {
    return { error: `Invalid move: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Update game state
  const newFen = chess.fen();
  const newPgn = chess.pgn();
  const updatedPlayerTime = playerTimeRemaining; // Player's time after their move

  // Check for terminal conditions (chess instance has full history)
  const terminalStatus = checkTerminal(chess);
  if (terminalStatus) {
    return {
      game: {
        ...game,
        fen: newFen,
        pgn: newPgn,
        status: terminalStatus.status,
        winner: terminalStatus.winner,
        playerTimeMs: updatedPlayerTime,
        lastMoveAt: now,
        positionHistory: [...game.positionHistory, stripCounters(newFen)],
        sideToMove: "black",
        plyCount: game.plyCount + 1,
        positionRevision: game.positionRevision + 1,
        terminatedAt: now,
        terminationReason: terminalStatus.reason,
      },
    };
  }

  // Game continues - bot's turn
  return {
    game: {
      ...game,
      fen: newFen,
      pgn: newPgn,
      playerTimeMs: updatedPlayerTime,
      lastMoveAt: now,
      positionHistory: [...game.positionHistory, stripCounters(newFen)],
      sideToMove: "black",
      plyCount: game.plyCount + 1,
      positionRevision: game.positionRevision + 1,
    },
  };
}

/**
 * Apply a bot move (server trusts client-selected legal move with casual trust model).
 */
export function applyBotMove(
  game: ChessPlayerGame,
  botMove: { from: string; to: string; promotion?: string },
  now: number,
): { game: ChessPlayerGame } | { error: string } {
  if (game.status !== "in-progress") {
    return { error: "Game is not in progress" };
  }

  if (game.sideToMove !== game.botColor) {
    return { error: "Not bot's turn" };
  }

  // Check bot hasn't flagged
  const elapsed = now - game.lastMoveAt;
  const botTimeRemaining = game.botTimeMs - elapsed;
  if (botTimeRemaining <= 0) {
    return applyTimeout(game, "bot", now);
  }

  // Rehydrate chess instance with full history for repetition detection
  const chess = new Chess();
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  } else {
    chess.load(game.fen);
  }

  // Apply bot move
  try {
    const move = chess.move({
      from: botMove.from,
      to: botMove.to,
      promotion: botMove.promotion as "q" | "r" | "b" | "n" | undefined,
    });

    if (!move) {
      return { error: "Illegal bot move" };
    }
  } catch (e) {
    return { error: `Invalid bot move: ${e instanceof Error ? e.message : String(e)}` };
  }

  const newFen = chess.fen();
  const newPgn = chess.pgn();
  const updatedBotTime = botTimeRemaining;

  // Check for terminal conditions (chess instance has full history)
  const terminalStatus = checkTerminal(chess);
  if (terminalStatus) {
    return {
      game: {
        ...game,
        fen: newFen,
        pgn: newPgn,
        status: terminalStatus.status,
        winner: terminalStatus.winner,
        botTimeMs: updatedBotTime,
        lastMoveAt: now,
        positionHistory: [...game.positionHistory, stripCounters(newFen)],
        sideToMove: "white",
        plyCount: game.plyCount + 1,
        positionRevision: game.positionRevision + 1,
        terminatedAt: now,
        terminationReason: terminalStatus.reason,
      },
    };
  }

  // Game continues - player's turn
  return {
    game: {
      ...game,
      fen: newFen,
      pgn: newPgn,
      botTimeMs: updatedBotTime,
      lastMoveAt: now,
      positionHistory: [...game.positionHistory, stripCounters(newFen)],
      sideToMove: "white",
      plyCount: game.plyCount + 1,
      positionRevision: game.positionRevision + 1,
    },
  };
}

/**
 * Handle resignation.
 */
export function resignGame(
  game: ChessPlayerGame,
  now: number,
): ChessPlayerGame {
  if (game.status !== "in-progress") {
    return game;
  }

  return {
    ...game,
    status: "resignation",
    winner: "bot",
    terminatedAt: now,
    terminationReason: "Player resigned",
  };
}

/**
 * Check for terminal game conditions.
 * IMPORTANT: Pass the chess instance that has been used for all moves (with history).
 * Creating a new Chess(fen) loses repetition history.
 */
function checkTerminal(
  chess: Chess,
):
  | {
      status: ChessGameStatus;
      winner?: "player" | "bot" | "draw";
      reason: string;
    }
  | null {
  // Checkmate
  if (chess.isCheckmate()) {
    // Current side to move is in checkmate, so previous mover won
    const winner = chess.turn() === "w" ? "bot" : "player";
    return {
      status: "checkmate",
      winner,
      reason: winner === "player" ? "Checkmate! You won" : "Checkmate - bot wins",
    };
  }

  // Stalemate
  if (chess.isStalemate()) {
    return {
      status: "stalemate",
      winner: "draw",
      reason: "Stalemate - draw",
    };
  }

  // Insufficient material
  if (chess.isInsufficientMaterial()) {
    return {
      status: "insufficient-material",
      winner: "draw",
      reason: "Draw by insufficient material",
    };
  }

  // Threefold repetition (requires full move history, not just FEN)
  if (chess.isThreefoldRepetition()) {
    return {
      status: "threefold-repetition",
      winner: "draw",
      reason: "Draw by threefold repetition",
    };
  }

  // 50-move rule (chess.js automatically tracks this)
  if (chess.isDraw()) {
    return {
      status: "fifty-move-rule",
      winner: "draw",
      reason: "Draw by fifty-move rule",
    };
  }

  return null;
}

/**
 * Apply timeout when a side runs out of time.
 */
function applyTimeout(
  game: ChessPlayerGame,
  flagged: "player" | "bot",
  now: number,
): { game: ChessPlayerGame } {
  // Check if opponent can deliver checkmate
  const chess = new Chess(game.fen);
  const canMate = hasMateMaterial(chess, flagged === "player" ? "b" : "w");

  if (!canMate) {
    // Timeout draw - opponent cannot mate
    return {
      game: {
        ...game,
        status: "timeout-draw",
        winner: "draw",
        playerTimeMs: flagged === "player" ? 0 : game.playerTimeMs,
        botTimeMs: flagged === "bot" ? 0 : game.botTimeMs,
        terminatedAt: now,
        terminationReason: `${flagged === "player" ? "Player" : "Bot"} flagged but opponent cannot mate - draw`,
      },
    };
  }

  // Timeout win for opponent
  return {
    game: {
      ...game,
      status: "timeout",
      winner: flagged === "player" ? "bot" : "player",
      playerTimeMs: flagged === "player" ? 0 : game.playerTimeMs,
      botTimeMs: flagged === "bot" ? 0 : game.botTimeMs,
      terminatedAt: now,
      terminationReason: `${flagged === "player" ? "Player" : "Bot"} ran out of time`,
    },
  };
}

/**
 * Check if a side has sufficient mating material.
 * Simplified check: K+Q, K+R, K+B+B, K+B+N, K+N+N or K+pawns can mate.
 */
function hasMateMaterial(chess: Chess, color: "w" | "b"): boolean {
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

  // Can mate with: queen, rook, 2 bishops, bishop+knight, 2 knights (barely), or any pawn
  if (queens > 0 || rooks > 0 || pawns > 0) return true;
  if (bishops >= 2) return true;
  if (bishops >= 1 && knights >= 1) return true;
  if (knights >= 2) return true; // Technically can mate (but very hard)

  return false;
}

/**
 * Strip move counters from FEN for position history (for repetition detection).
 */
function stripCounters(fen: string): string {
  const parts = fen.split(" ");
  return parts.slice(0, 4).join(" ");
}

/**
 * Project guest snapshot (own game only).
 */
export function projectGuestSnapshot(game: ChessPlayerGame, paused: boolean): ChessGuestSnapshot {
  const chess = new Chess(game.fen);

  return {
    gameId: game.gameId,
    fen: game.fen,
    pgn: game.pgn,
    status: game.status,
    playerColor: game.playerColor,
    botColor: game.botColor,
    playerTimeMs: game.playerTimeMs,
    botTimeMs: game.botTimeMs,
    sideToMove: game.sideToMove,
    plyCount: game.plyCount,
    positionRevision: game.positionRevision,
    lastMoveAt: game.lastMoveAt,
    paused,
    winner: game.winner,
    terminationReason: game.terminationReason,
    inCheck: chess.inCheck(),
    isGameOver: game.status !== "in-progress" && game.status !== "waiting",
  };
}

/**
 * Project stage snapshot (aggregate only).
 */
export function projectStageSnapshot(
  state: ChessRoundState,
  nicknameMap: Map<string, string>,
): ChessStageSnapshot {
  const games = Object.values(state.games);
  const results = {
    playerWins: 0,
    botWins: 0,
    draws: 0,
    aborts: 0,
  };

  for (const game of games) {
    if (game.winner === "player") results.playerWins++;
    else if (game.winner === "bot") results.botWins++;
    else if (game.winner === "draw") results.draws++;
    else if (game.status === "aborted") results.aborts++;
  }

  // Recent terminal events (last 10)
  const recentEvents = games
    .filter((g) => g.terminatedAt !== undefined)
    .sort((a, b) => (b.terminatedAt ?? 0) - (a.terminatedAt ?? 0))
    .slice(0, 10)
    .map((g) => ({
      playerId: g.playerId,
      nickname: nicknameMap.get(g.playerId) ?? "Guest",
      event: determineEvent(g),
      timestamp: g.terminatedAt!,
    }));

  return {
    totalGames: games.length,
    inProgress: state.gamesInProgress,
    finished: state.gamesFinished,
    results,
    recentEvents,
  };
}

/**
 * Project host control snapshot.
 */
export function projectControlSnapshot(
  state: ChessRoundState,
  nicknameMap: Map<string, string>,
): ChessControlSnapshot {
  const stageSnapshot = projectStageSnapshot(state, nicknameMap);
  const games = Object.values(state.games);

  const gameStatuses = games.map((g) => ({
    playerId: g.playerId,
    nickname: nicknameMap.get(g.playerId) ?? "Guest",
    status: g.status,
    plyCount: g.plyCount,
    playerTimeMs: g.playerTimeMs,
    botTimeMs: g.botTimeMs,
  }));

  return {
    ...stageSnapshot,
    gameStatuses,
  };
}

function determineEvent(
  game: ChessPlayerGame,
): "checkmate-win" | "checkmate-loss" | "draw" | "timeout" | "resign" | "abort" {
  if (game.status === "aborted") return "abort";
  if (game.status === "resignation") return "resign";
  if (game.status === "timeout" || game.status === "timeout-draw") return "timeout";
  if (game.status === "checkmate") {
    return game.winner === "player" ? "checkmate-win" : "checkmate-loss";
  }
  return "draw";
}

/**
 * Update round aggregate after a game finishes.
 */
export function updateRoundAggregates(state: ChessRoundState): ChessRoundState {
  const games = Object.values(state.games);
  const inProgress = games.filter((g) => g.status === "in-progress").length;
  const finished = games.filter((g) => g.status !== "in-progress" && g.status !== "waiting")
    .length;

  return {
    ...state,
    gamesInProgress: inProgress,
    gamesFinished: finished,
    allGamesComplete: inProgress === 0 && finished === games.length,
  };
}

/**
 * Calculate final score for a completed game.
 */
export function calculateChessScore(game: ChessPlayerGame): number {
  if (game.winner === "player") return 100;
  if (game.winner === "draw") return 50;
  return 0; // Loss or abort
}
