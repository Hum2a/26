/**
 * Chess command parameters for frontend submission.
 * These are the payloads submitted via room socket, separate from full command schemas.
 */

export type ChessMoveParams = {
  gameId: string;
  from: string; // "e2"
  to: string; // "e4"
  promotion?: "q" | "r" | "b" | "n";
  positionRevision: number;
};

export type ChessResignParams = {
  gameId: string;
};
