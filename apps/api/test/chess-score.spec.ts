import { describe, expect, it } from "vitest";
import {
  capturedBlackPieces,
  chessCapturedPoints,
  chessPiecePoints,
  chessRoundScore,
  chessStartingBlackMaterial,
  pointsForChessPiece,
  type ChessPlayerGame,
} from "@26/shared";
import {
  applyBotMove,
  applyChessMove,
  capturedBlackMaterial,
  calculateChessScore,
  initializeChessRound,
} from "../src/questions/chess-coordinator.ts";

const now = 1_700_000_000_000;
const roundId = "score-round";
const playerId = "player1";

type SquareMove = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

function play(moves: SquareMove[]): ChessPlayerGame {
  let game = initializeChessRound(roundId, [playerId], now).games[playerId];
  let t = now;
  for (const move of moves) {
    t += 200;
    if (game.sideToMove === "white") {
      const result = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: `m-${t}`,
          gameId: game.gameId,
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          positionRevision: game.positionRevision,
        },
        t,
      );
      if ("error" in result) {
        throw new Error(result.error);
      }
      game = result.game;
    } else {
      const result = applyBotMove(game, move, t);
      if ("error" in result) {
        throw new Error(result.error);
      }
      game = result.game;
    }
  }
  return game;
}

describe("chess piece values", () => {
  it("scores each captured Black piece at the party values", () => {
    expect(pointsForChessPiece("p")).toBe(1);
    expect(pointsForChessPiece("n")).toBe(3);
    expect(pointsForChessPiece("b")).toBe(3);
    expect(pointsForChessPiece("r")).toBe(5);
    expect(pointsForChessPiece("q")).toBe(10);
    expect(chessPiecePoints.p + chessPiecePoints.n).toBe(4);
    expect(chessStartingBlackMaterial).toBe(40);
  });

  it("ignores White captures and kings", () => {
    expect(
      chessCapturedPoints(
        capturedBlackPieces([
          { color: "w", captured: "p" },
          { color: "b", captured: "q" },
          { color: "w", captured: "k" },
        ]),
      ),
    ).toBe(1);
  });
});

describe("captures from validated history", () => {
  it("scores a captured pawn as 1", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "d7", to: "d5" },
      { from: "e4", to: "d5" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(1);
    expect(calculateChessScore(game)).toBe(1);
  });

  it("scores a captured knight as 3", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "b8", to: "c6" },
      { from: "d2", to: "d4" },
      { from: "c6", to: "d4" },
      { from: "d1", to: "d4" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(3);
  });

  it("scores a captured bishop as 3", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
      { from: "g1", to: "f3" },
      { from: "d7", to: "d6" },
      { from: "f1", to: "c4" },
      { from: "c8", to: "e6" },
      { from: "c4", to: "e6" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(3);
  });

  it("scores a captured rook as 5", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "a7", to: "a5" },
      { from: "d2", to: "d4" },
      { from: "a5", to: "a4" },
      { from: "c2", to: "c4" },
      { from: "a4", to: "a3" },
      { from: "b1", to: "a3" },
      { from: "a8", to: "a3" },
      { from: "b2", to: "a3" },
    ]);
    // Knight takes the a-pawn (1), then the rook is recaptured (5).
    expect(capturedBlackMaterial(game.pgn)).toBe(6);
  });

  it("scores a captured queen as 10", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "d7", to: "d5" },
      { from: "e4", to: "d5" },
      { from: "d8", to: "d5" },
      { from: "b1", to: "c3" },
      { from: "d5", to: "a5" },
      { from: "b2", to: "b4" },
      { from: "a5", to: "b4" },
      { from: "a1", to: "b1" },
      { from: "b4", to: "c3" },
      { from: "d2", to: "c3" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(11);
  });

  it("counts en passant as a pawn", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "a7", to: "a6" },
      { from: "e4", to: "e5" },
      { from: "d7", to: "d5" },
      { from: "e5", to: "d6" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(1);
  });

  it("counts a promoted Black piece at its promoted value", () => {
    const game = play([
      { from: "h2", to: "h3" },
      { from: "a7", to: "a5" },
      { from: "h3", to: "h4" },
      { from: "a5", to: "a4" },
      { from: "h4", to: "h5" },
      { from: "a4", to: "a3" },
      { from: "h5", to: "h6" },
      { from: "a3", to: "b2" },
      { from: "h6", to: "g7" },
      { from: "b2", to: "a1", promotion: "q" },
      { from: "c2", to: "c3" },
      { from: "a1", to: "c3" },
      { from: "b1", to: "c3" },
    ]);
    expect(capturedBlackMaterial(game.pgn)).toBe(11);
  });
});

describe("results do not award their own points", () => {
  it("awards 40 for checkmate even with almost no captures", () => {
    const game = play([
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
      { from: "d1", to: "h5" },
      { from: "b8", to: "c6" },
      { from: "f1", to: "c4" },
      { from: "g8", to: "f6" },
      { from: "h5", to: "f7" },
    ]);
    expect(game.status).toBe("checkmate");
    expect(game.winner).toBe("player");
    expect(capturedBlackMaterial(game.pgn)).toBe(1);
    expect(calculateChessScore(game)).toBe(40);
  });

  it("keeps captured material above 40 when checkmate would otherwise award 40", () => {
    expect(
      chessRoundScore({
        capturedPoints: 49,
        status: "checkmate",
        winner: "player",
      }),
    ).toBe(49);
    const promoted = play([
      { from: "h2", to: "h3" },
      { from: "a7", to: "a5" },
      { from: "h3", to: "h4" },
      { from: "a5", to: "a4" },
      { from: "h4", to: "h5" },
      { from: "a4", to: "a3" },
      { from: "h5", to: "h6" },
      { from: "a3", to: "b2" },
      { from: "h6", to: "g7" },
      { from: "b2", to: "a1", promotion: "q" },
      { from: "c2", to: "c3" },
      { from: "a1", to: "c3" },
      { from: "b1", to: "c3" },
    ]);
    const mated: ChessPlayerGame = {
      ...promoted,
      status: "checkmate",
      winner: "player",
    };
    expect(capturedBlackMaterial(mated.pgn)).toBe(11);
    expect(calculateChessScore(mated)).toBe(40);
    expect(
      chessRoundScore({
        capturedPoints: capturedBlackMaterial(mated.pgn) + 39,
        status: "checkmate",
        winner: "player",
      }),
    ).toBe(50);
  });

  it("keeps captured points on loss, timeout, resign and abort", () => {
    const captures = play([
      { from: "e2", to: "e4" },
      { from: "d7", to: "d5" },
      { from: "e4", to: "d5" },
    ]);
    expect(capturedBlackMaterial(captures.pgn)).toBe(1);

    expect(
      calculateChessScore({ ...captures, status: "checkmate", winner: "bot" }),
    ).toBe(1);
    expect(calculateChessScore({ ...captures, status: "timeout", winner: "bot" })).toBe(
      1,
    );
    expect(
      calculateChessScore({ ...captures, status: "resignation", winner: "bot" }),
    ).toBe(1);
    expect(calculateChessScore({ ...captures, status: "aborted" })).toBe(1);
    expect(
      calculateChessScore({ ...captures, status: "stalemate", winner: "draw" }),
    ).toBe(1);
  });

  it("gives no points from a result with nothing captured, except checkmate", () => {
    const start = initializeChessRound(roundId, [playerId], now).games[playerId];
    expect(calculateChessScore({ ...start, winner: "player", status: "timeout" })).toBe(
      0,
    );
    expect(calculateChessScore({ ...start, winner: "draw", status: "stalemate" })).toBe(
      0,
    );
    expect(
      calculateChessScore({ ...start, winner: "bot", status: "resignation" }),
    ).toBe(0);
    expect(calculateChessScore({ ...start, status: "aborted" })).toBe(0);
    expect(
      chessRoundScore({ capturedPoints: 0, status: "checkmate", winner: "player" }),
    ).toBe(40);
  });
});
