import type { ChessGameStatus } from "./chess-schemas.ts";

/** Material values for Black pieces captured by the guest (White). */
export const chessPiecePoints = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 10,
} as const;

/** 8 pawns + 2 knights + 2 bishops + 2 rooks + queen. */
export const chessStartingBlackMaterial =
  8 * chessPiecePoints.p +
  2 * chessPiecePoints.n +
  2 * chessPiecePoints.b +
  2 * chessPiecePoints.r +
  chessPiecePoints.q;

export type ChessCaptureMove = {
  color: "w" | "b";
  captured?: string;
};

export function pointsForChessPiece(piece: string): number {
  const kind = piece.toLowerCase();
  if (kind === "p" || kind === "n" || kind === "b" || kind === "r" || kind === "q") {
    return chessPiecePoints[kind];
  }
  return 0;
}

export function capturedBlackPieces(moves: readonly ChessCaptureMove[]): string[] {
  const pieces: string[] = [];
  for (const move of moves) {
    if (move.color === "w" && move.captured) {
      pieces.push(move.captured);
    }
  }
  return pieces;
}

export function chessCapturedPoints(pieces: readonly string[]): number {
  return pieces.reduce((total, piece) => total + pointsForChessPiece(piece), 0);
}

/**
 * Round score from captured Black material.
 * Checkmate awards at least the starting Black total; promotions can exceed it.
 * Other results keep captures only — they never add win/draw/loss points.
 */
export function chessRoundScore(input: {
  capturedPoints: number;
  status: ChessGameStatus;
  winner?: "player" | "bot" | "draw";
}): number {
  const captured = Math.max(0, input.capturedPoints);
  if (input.status === "checkmate" && input.winner === "player") {
    return Math.max(captured, chessStartingBlackMaterial);
  }
  return captured;
}
