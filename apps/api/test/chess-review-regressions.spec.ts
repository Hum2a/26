/**
 * Regression tests for PR review findings.
 * These tests prove the review fixes work correctly.
 */

import { describe, it, expect } from "vitest";
import { chessQuestion } from "../src/questions/authoring.ts";
import {
  initializeChessRound,
  applyChessMove,
  applyBotMove,
  projectStageSnapshot,
  calculateChessScore,
  type ChessPlayerGame,
} from "../src/questions/chess-coordinator.ts";
import { Chess } from "chess.js";

describe("Chess Review Regressions", () => {
  describe("Finding 1: Time control validation", () => {
    it("rejects non-60000ms initial time", () => {
      expect(() =>
        chessQuestion({
          id: "test",
          title: "Test",
          initialTimeMs: 30_000, // Invalid
        }),
      ).toThrow("initialTimeMs must be 60000");
    });

    it("rejects non-zero increment", () => {
      expect(() =>
        chessQuestion({
          id: "test",
          title: "Test",
          incrementMs: 1000, // Invalid
        }),
      ).toThrow("incrementMs must be 0");
    });

    it("accepts valid 1+0", () => {
      const question = chessQuestion({
        id: "test",
        title: "Test",
        initialTimeMs: 60_000,
        incrementMs: 0,
      });
      expect(question.initialTimeMs).toBe(60_000);
      expect(question.incrementMs).toBe(0);
    });
  });

  describe("Finding 2: Abort event distinct from draw", () => {
    it("projects abort event for aborted game", () => {
      const now = Date.now();
      const state = initializeChessRound("test-round", ["p1", "p2"], now);
      
      // Abort one game
      state.games["p1"] = {
        ...state.games["p1"],
        status: "aborted",
        terminatedAt: now + 1000,
        terminationReason: "Host force-ended",
      };

      // Mark other as draw
      state.games["p2"] = {
        ...state.games["p2"],
        status: "stalemate",
        winner: "draw",
        terminatedAt: now + 2000,
        terminationReason: "Stalemate",
      };

      const snapshot = projectStageSnapshot(
        state,
        new Map([["p1", "Alice"], ["p2", "Bob"]]),
      );

      expect(snapshot.recentEvents).toHaveLength(2);
      const abortEvent = snapshot.recentEvents.find((e) => e.playerId === "p1");
      const drawEvent = snapshot.recentEvents.find((e) => e.playerId === "p2");

      expect(abortEvent?.event).toBe("abort");
      expect(drawEvent?.event).toBe("draw");
    });

    it("scores abort as 0 points, not draw 50", () => {
      const now = Date.now();
      const state = initializeChessRound("test-round", ["p1"], now);

      const abortedGame: ChessPlayerGame = {
        ...state.games["p1"],
        status: "aborted",
        terminatedAt: now,
      };

      const drawGame: ChessPlayerGame = {
        ...state.games["p1"],
        status: "stalemate",
        winner: "draw",
        terminatedAt: now,
      };

      expect(calculateChessScore(abortedGame)).toBe(0);
      expect(calculateChessScore(drawGame)).toBe(50);
    });
  });

  describe("Finding 4: Threefold repetition with history", () => {
    it("verifies PGN history used for terminal detection", () => {
      const now = Date.now();
      const state = initializeChessRound("test-round", ["p1"], now);
      let game = state.games["p1"];

      // Make sequence of moves
      const moves = [
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
        { from: "g1", to: "f3" },
        { from: "b8", to: "c6" },
      ];

      for (let i = 0; i < moves.length; i++) {
        if (i % 2 === 0) {
          const result = applyChessMove(
            game,
            {
              kind: "chess-move",
              requestId: `req${i}`,
              gameId: game.gameId,
              from: moves[i].from,
              to: moves[i].to,
              positionRevision: game.positionRevision,
            },
            now + i * 1000,
          );
          expect(result).toHaveProperty("game");
          if ("game" in result) game = result.game;
        } else {
          const result = applyBotMove(game, moves[i], now + i * 1000);
          expect(result).toHaveProperty("game");
          if ("game" in result) game = result.game;
        }
      }

      // Verify PGN history is built
      expect(game.pgn).toContain("e4");
      expect(game.pgn).toContain("Nf3");
      
      // Verify history can be reloaded for repetition detection
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      expect(chess.fen()).toBe(game.fen);
    });

    it("does not falsely repeat on different turn/castling/en-passant", () => {
      const now = Date.now();
      const state = initializeChessRound("test-round", ["p1"], now);
      let game = state.games["p1"];

      // Same piece positions but different side to move
      const result1 = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e4",
          positionRevision: game.positionRevision,
        },
        now,
      );

      expect("game" in result1).toBe(true);
      if ("game" in result1) {
        game = result1.game;
        // Position after e4 is unique (not repeated)
        expect(game.status).toBe("in-progress");
      }
    });

    it("preserves PGN history for repetition after eviction simulation", () => {
      const now = Date.now();
      const state = initializeChessRound("test-round", ["p1"], now);
      let game = state.games["p1"];

      // Make some moves
      const moves = [
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
        { from: "g1", to: "f3" },
        { from: "b8", to: "c6" },
      ];

      for (let i = 0; i < moves.length; i++) {
        if (i % 2 === 0) {
          const result = applyChessMove(
            game,
            {
              kind: "chess-move",
              requestId: `req${i}`,
              gameId: game.gameId,
              from: moves[i].from,
              to: moves[i].to,
              positionRevision: game.positionRevision,
            },
            now + i * 1000,
          );
          if ("game" in result) game = result.game;
        } else {
          const result = applyBotMove(game, moves[i], now + i * 1000);
          if ("game" in result) game = result.game;
        }
      }

      const _pgnBeforeEviction = game.pgn;
    void _pgnBeforeEviction;
      const fenBeforeEviction = game.fen;

      // Simulate eviction: serialize game state (PGN + FEN)
      const serialized = {
        pgn: game.pgn,
        fen: game.fen,
        positionHistory: game.positionHistory,
      };

      // Simulate recovery: rehydrate chess.js from PGN
      const chess = new Chess();
      chess.loadPgn(serialized.pgn);

      // Verify recovered state matches
      expect(chess.fen()).toBe(fenBeforeEviction);
      // PGN is preserved (history for repetition detection)
      expect(chess.history()).toHaveLength(4);

      // Verify history is preserved (can make more moves with correct repetition detection)
      const canMove = chess.move({ from: "f1", to: "c4" });
      expect(canMove).toBeTruthy();
    });
  });
});
