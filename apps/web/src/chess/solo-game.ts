import { Chess } from "chess.js";
import {
  capturedBlackPieces,
  chessCapturedPoints,
  chessRoundScore,
  type ChessGuestSnapshot,
  type ChessGameStatus,
  type ChessPromotionPiece,
} from "@26/shared";

const startFen = new Chess().fen();

export function createSoloSnapshot(
  now: number,
  gameId = "solo-chess",
): ChessGuestSnapshot {
  return {
    gameId,
    fen: startFen,
    pgn: "",
    status: "in-progress",
    playerColor: "white",
    botColor: "black",
    playerTimeMs: 60_000,
    botTimeMs: 60_000,
    sideToMove: "white",
    plyCount: 0,
    positionRevision: 0,
    lastMoveAt: now,
    paused: false,
    inCheck: false,
    isGameOver: false,
    capturedPoints: 0,
    score: 0,
  };
}

export function applySoloMove(
  snapshot: ChessGuestSnapshot,
  from: string,
  to: string,
  now: number,
  promotion?: ChessPromotionPiece,
): ChessGuestSnapshot | { error: string } {
  if (snapshot.isGameOver || snapshot.status !== "in-progress") {
    return { error: "Game is not in progress" };
  }

  const elapsed = Math.max(0, now - snapshot.lastMoveAt);
  const moverIsPlayer = snapshot.sideToMove === snapshot.playerColor;
  const playerTimeMs = moverIsPlayer
    ? snapshot.playerTimeMs - elapsed
    : snapshot.playerTimeMs;
  const botTimeMs = moverIsPlayer ? snapshot.botTimeMs : snapshot.botTimeMs - elapsed;

  if (playerTimeMs <= 0) {
    return flagSolo(snapshot, "player", now);
  }
  if (botTimeMs <= 0) {
    return flagSolo(snapshot, "bot", now);
  }

  const chess = new Chess();
  if (snapshot.pgn) {
    chess.loadPgn(snapshot.pgn);
  }

  try {
    const move = chess.move({ from, to, promotion });
    if (!move) {
      return { error: "Illegal move" };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Illegal move" };
  }

  const capturedPoints = chessCapturedPoints(
    capturedBlackPieces(chess.history({ verbose: true })),
  );
  const terminal = readTerminal(chess);
  const status = terminal?.status ?? "in-progress";
  const winner = terminal?.winner;
  const score = chessRoundScore({ capturedPoints, status, winner });

  return {
    ...snapshot,
    fen: chess.fen(),
    pgn: chess.pgn(),
    status,
    winner,
    playerTimeMs,
    botTimeMs,
    lastMoveAt: now,
    sideToMove: chess.turn() === "w" ? "white" : "black",
    plyCount: snapshot.plyCount + 1,
    positionRevision: snapshot.positionRevision + 1,
    terminationReason: terminal?.reason,
    inCheck: chess.inCheck(),
    isGameOver: Boolean(terminal),
    capturedPoints,
    score,
  };
}

export function expireSoloClock(
  snapshot: ChessGuestSnapshot,
  now: number,
): ChessGuestSnapshot {
  if (snapshot.isGameOver) {
    return snapshot;
  }
  const elapsed = Math.max(0, now - snapshot.lastMoveAt);
  const remaining =
    snapshot.sideToMove === snapshot.playerColor
      ? snapshot.playerTimeMs - elapsed
      : snapshot.botTimeMs - elapsed;
  if (remaining > 0) {
    return snapshot;
  }
  return flagSolo(
    snapshot,
    snapshot.sideToMove === snapshot.playerColor ? "player" : "bot",
    now,
  );
}

export function resignSolo(
  snapshot: ChessGuestSnapshot,
  now: number,
): ChessGuestSnapshot {
  if (snapshot.isGameOver) {
    return snapshot;
  }
  const score = chessRoundScore({
    capturedPoints: snapshot.capturedPoints,
    status: "resignation",
    winner: "bot",
  });
  return {
    ...snapshot,
    status: "resignation",
    winner: "bot",
    lastMoveAt: now,
    terminationReason: "Player resigned",
    isGameOver: true,
    score,
  };
}

function flagSolo(
  snapshot: ChessGuestSnapshot,
  flagged: "player" | "bot",
  now: number,
): ChessGuestSnapshot {
  const chess = new Chess(snapshot.fen);
  const opponent = flagged === "player" ? "b" : "w";
  const canMate = hasMateMaterial(chess, opponent);
  const status: ChessGameStatus = canMate ? "timeout" : "timeout-draw";
  const winner = canMate ? (flagged === "player" ? "bot" : "player") : "draw";
  const score = chessRoundScore({
    capturedPoints: snapshot.capturedPoints,
    status,
    winner,
  });
  return {
    ...snapshot,
    status,
    winner,
    playerTimeMs: flagged === "player" ? 0 : snapshot.playerTimeMs,
    botTimeMs: flagged === "bot" ? 0 : snapshot.botTimeMs,
    lastMoveAt: now,
    terminationReason:
      flagged === "player" ? "You ran out of time" : "Bot ran out of time",
    isGameOver: true,
    score,
  };
}

function readTerminal(chess: Chess): {
  status: ChessGameStatus;
  winner?: "player" | "bot" | "draw";
  reason: string;
} | null {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "bot" : "player";
    return {
      status: "checkmate",
      winner,
      reason: winner === "player" ? "Checkmate! You won" : "Checkmate — bot wins",
    };
  }
  if (chess.isStalemate()) {
    return { status: "stalemate", winner: "draw", reason: "Stalemate — draw" };
  }
  if (chess.isInsufficientMaterial()) {
    return {
      status: "insufficient-material",
      winner: "draw",
      reason: "Draw by insufficient material",
    };
  }
  if (chess.isThreefoldRepetition()) {
    return {
      status: "threefold-repetition",
      winner: "draw",
      reason: "Draw by repetition",
    };
  }
  if (chess.isDraw()) {
    return { status: "fifty-move-rule", winner: "draw", reason: "Draw" };
  }
  return null;
}

function hasMateMaterial(chess: Chess, color: "w" | "b"): boolean {
  let queens = 0;
  let rooks = 0;
  let bishops = 0;
  let knights = 0;
  let pawns = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color) {
        if (square.type === "q") queens++;
        if (square.type === "r") rooks++;
        if (square.type === "b") bishops++;
        if (square.type === "n") knights++;
        if (square.type === "p") pawns++;
      }
    }
  }
  if (queens > 0 || rooks > 0 || pawns > 0) return true;
  if (bishops >= 2) return true;
  if (bishops >= 1 && knights >= 1) return true;
  if (knights >= 2) return true;
  return false;
}
