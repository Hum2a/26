import { z } from "zod";

/**
 * Chess game state and wire protocol schemas for 1+0 time control.
 * Server is authoritative for all game state, clocks, and scoring.
 */

export const chessColorSchema = z.enum(["white", "black"]);
export type ChessColor = z.infer<typeof chessColorSchema>;

export const chessGameStatusSchema = z.enum([
  "waiting", // Before game starts
  "in-progress", // Game is active
  "checkmate", // Terminal: checkmate
  "stalemate", // Terminal: stalemate
  "insufficient-material", // Terminal: draw by insufficient material
  "threefold-repetition", // Terminal: draw by repetition
  "fifty-move-rule", // Terminal: draw by 50-move rule
  "timeout", // Terminal: one side flagged
  "timeout-draw", // Terminal: timeout but opponent cannot mate
  "resignation", // Terminal: player resigned
  "aborted", // Terminal: host force-ended or technical abort
]);
export type ChessGameStatus = z.infer<typeof chessGameStatusSchema>;

export const chessPromotionPieceSchema = z.enum(["q", "r", "b", "n"]);
export type ChessPromotionPiece = z.infer<typeof chessPromotionPieceSchema>;

/**
 * Guest submits a move.
 * Server validates: ownership, current position, side to move, legality.
 */
export const chessMoveCommandSchema = z
  .object({
    kind: z.literal("chess-move"),
    requestId: z.string(),
    gameId: z.string(),
    from: z.string().regex(/^[a-h][1-8]$/), // e.g. "e2"
    to: z.string().regex(/^[a-h][1-8]$/), // e.g. "e4"
    promotion: chessPromotionPieceSchema.optional(), // Required for pawn promotion
  })
  .strict();
export type ChessMoveCommand = z.infer<typeof chessMoveCommandSchema>;

/**
 * Guest resigns their game.
 */
export const chessResignCommandSchema = z
  .object({
    kind: z.literal("chess-resign"),
    requestId: z.string(),
    gameId: z.string(),
  })
  .strict();
export type ChessResignCommand = z.infer<typeof chessResignCommandSchema>;

/**
 * Per-player game state (server-authoritative).
 * FEN includes full position + castling rights + en passant + counters.
 */
export const chessPlayerGameSchema = z.object({
  gameId: z.string(),
  playerId: z.string(),
  playerColor: chessColorSchema,
  botColor: chessColorSchema,
  fen: z.string(), // Current position
  pgn: z.string(), // Full game in PGN notation for history/replay
  status: chessGameStatusSchema,
  winner: z.enum(["player", "bot", "draw"]).optional(),
  // 1+0 clocks: milliseconds remaining, server-authoritative
  playerTimeMs: z.number().int().min(0),
  botTimeMs: z.number().int().min(0),
  // Last move timestamp for timeout enforcement
  lastMoveAt: z.number().int(),
  // Move history for repetition detection (minimal: just positions)
  positionHistory: z.array(z.string()), // FENs without move counters
  // Tracks whose turn it is
  sideToMove: chessColorSchema,
  // Move count (ply number)
  plyCount: z.number().int().min(0),
  // Terminal result details
  terminatedAt: z.number().int().optional(),
  terminationReason: z.string().optional(),
});
export type ChessPlayerGame = z.infer<typeof chessPlayerGameSchema>;

/**
 * Aggregate room-wide chess state.
 */
export const chessRoundStateSchema = z.object({
  roundId: z.string(),
  startedAt: z.number().int(),
  frozenParticipants: z.array(z.string()), // Player IDs eligible for this round
  // Map of playerId -> game state
  games: z.record(z.string(), chessPlayerGameSchema),
  // Completion tracking
  gamesInProgress: z.number().int().min(0),
  gamesFinished: z.number().int().min(0),
  allGamesComplete: z.boolean(),
});
export type ChessRoundState = z.infer<typeof chessRoundStateSchema>;

/**
 * Public snapshot for guest phone (own game only).
 */
export const chessGuestSnapshotSchema = z.object({
  gameId: z.string(),
  fen: z.string(),
  pgn: z.string(),
  status: chessGameStatusSchema,
  playerColor: chessColorSchema,
  botColor: chessColorSchema,
  playerTimeMs: z.number().int().min(0),
  botTimeMs: z.number().int().min(0),
  sideToMove: chessColorSchema,
  plyCount: z.number().int().min(0),
  // Terminal state
  winner: z.enum(["player", "bot", "draw"]).optional(),
  terminationReason: z.string().optional(),
  // Can request legal moves from server for UI hints
  inCheck: z.boolean(),
  isGameOver: z.boolean(),
});
export type ChessGuestSnapshot = z.infer<typeof chessGuestSnapshotSchema>;

/**
 * Public snapshot for stage/projector (aggregate only, no individual boards).
 */
export const chessStageSnapshotSchema = z.object({
  totalGames: z.number(),
  inProgress: z.number(),
  finished: z.number(),
  results: z.object({
    playerWins: z.number(),
    botWins: z.number(),
    draws: z.number(),
    aborts: z.number(),
  }),
  // Recent events for announcements
  recentEvents: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      event: z.enum(["checkmate-win", "checkmate-loss", "draw", "timeout", "resign", "abort"]),
      timestamp: z.number(),
    }),
  ),
});
export type ChessStageSnapshot = z.infer<typeof chessStageSnapshotSchema>;

/**
 * Host-only control snapshot (aggregate + individual game health).
 */
export const chessControlSnapshotSchema = z.object({
  totalGames: z.number(),
  inProgress: z.number(),
  finished: z.number(),
  results: z.object({
    playerWins: z.number(),
    botWins: z.number(),
    draws: z.number(),
    aborts: z.number(),
  }),
  recentEvents: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      event: z.enum(["checkmate-win", "checkmate-loss", "draw", "timeout", "resign", "abort"]),
      timestamp: z.number(),
    }),
  ),
  // Individual game statuses for monitoring
  gameStatuses: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      status: chessGameStatusSchema,
      plyCount: z.number().int(),
      playerTimeMs: z.number().int(),
      botTimeMs: z.number().int(),
    }),
  ),
});
export type ChessControlSnapshot = z.infer<typeof chessControlSnapshotSchema>;
