import { describe, it, expect } from "vitest";
import {
  initializeChessRound,
  applyChessMove,
  applyBotMove,
  resignGame,
  calculateChessScore,
  projectGuestSnapshot,
  updateRoundAggregates,
} from "../src/questions/chess-coordinator.ts";

describe("Chess Coordinator", () => {
  const now = Date.now();
  const roundId = "test-round";
  const playerId = "player1";

  describe("initializeChessRound", () => {
    it("creates games for all participants starting from initial position", () => {
      const state = initializeChessRound(roundId, [playerId], now);

      expect(state.roundId).toBe(roundId);
      expect(state.frozenParticipants).toEqual([playerId]);
      expect(Object.keys(state.games)).toHaveLength(1);

      const game = state.games[playerId];
      expect(game.gameId).toBe(`${roundId}-${playerId}`);
      expect(game.playerColor).toBe("white");
      expect(game.botColor).toBe("black");
      expect(game.playerTimeMs).toBe(60_000);
      expect(game.botTimeMs).toBe(60_000);
      expect(game.status).toBe("in-progress");
      expect(game.sideToMove).toBe("white");
      expect(game.plyCount).toBe(0);
      expect(game.fen).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w/);
    });

    it("creates multiple games for multiple participants", () => {
      const state = initializeChessRound(roundId, ["p1", "p2", "p3"], now);
      expect(Object.keys(state.games)).toHaveLength(3);
      expect(state.gamesInProgress).toBe(3);
    });
  });

  describe("applyChessMove", () => {
    it("accepts legal e2e4 opening move", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = state.games[playerId];

      const result = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e4",
          positionRevision: 0,
        },
        now + 1000,
      );

      expect(result).toHaveProperty("game");
      if ("game" in result) {
        expect(result.game.fen).toContain("4P3"); // Pawn on e4
        expect(result.game.sideToMove).toBe("black");
        expect(result.game.plyCount).toBe(1);
        expect(result.game.playerTimeMs).toBeLessThan(60_000);
      }
    });

    it("rejects illegal move", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = state.games[playerId];

      const result = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e5", // Illegal - pawn can't move 3 squares
          positionRevision: game.positionRevision,
        },
        now + 1000,
      );

      expect(result).toHaveProperty("error");
    });

    it("rejects move when not player's turn", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Make one move so it's bot's turn
      const move1 = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e4",
          positionRevision: game.positionRevision,
        },
        now + 1000,
      );
      expect(move1).toHaveProperty("game");
      if ("game" in move1) game = move1.game;

      // Try to move again immediately
      const result = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req2",
          gameId: game.gameId,
          from: "d2",
          to: "d4",
          positionRevision: game.positionRevision,
        },
        now + 2000,
      );

      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error).toContain("Not your turn");
      }
    });

    it("handles pawn promotion", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Set up position with white pawn on 7th rank ready to promote
      // White king on a1, black king on h8, white pawn on e7
      game = {
        ...game,
        fen: "7k/4P3/8/8/8/8/8/K7 w - - 0 1",
        sideToMove: "white",
      };

      const result = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e7",
          to: "e8",
          promotion: "q",
          positionRevision: game.positionRevision,
        },
        now + 1000,
      );

      expect(result).toHaveProperty("game");
      if ("game" in result) {
        expect(result.game.fen).toContain("Q"); // Queen on board after promotion
        expect(result.game.plyCount).toBe(1);
      }
    });
  });

  describe("applyBotMove", () => {
    it("accepts legal bot move", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Player moves first
      const move1 = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e4",
          positionRevision: game.positionRevision,
        },
        now + 1000,
      );
      expect(move1).toHaveProperty("game");
      if ("game" in move1) game = move1.game;

      // Bot responds
      const result = applyBotMove(
        game,
        { from: "e7", to: "e5" },
        now + 2000,
      );

      expect(result).toHaveProperty("game");
      if ("game" in result) {
        expect(result.game.sideToMove).toBe("white");
        expect(result.game.plyCount).toBe(2);
        expect(result.game.botTimeMs).toBeLessThan(60_000);
      }
    });

    it("rejects illegal bot move", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Player moves
      const move1 = applyChessMove(
        game,
        {
          kind: "chess-move",
          requestId: "req1",
          gameId: game.gameId,
          from: "e2",
          to: "e4",
          positionRevision: game.positionRevision,
        },
        now + 1000,
      );
      if ("game" in move1) game = move1.game;

      // Bot tries illegal move
      const result = applyBotMove(
        game,
        { from: "e7", to: "e4" }, // Illegal
        now + 2000,
      );

      expect(result).toHaveProperty("error");
    });
  });

  describe("Terminal conditions", () => {
    it("detects checkmate (Fool's Mate)", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Fool's Mate sequence
      // 1. f3
      let result = applyChessMove(
        game,
        { kind: "chess-move", requestId: "1", gameId: game.gameId, from: "f2", to: "f3", positionRevision: game.positionRevision },
        now + 1000,
      );
      expect(result).toHaveProperty("game");
      if ("game" in result) game = result.game;

      // 1... e5
      result = applyBotMove(game, { from: "e7", to: "e5" }, now + 2000);
      expect(result).toHaveProperty("game");
      if ("game" in result) game = result.game;

      // 2. g4
      result = applyChessMove(
        game,
        { kind: "chess-move", requestId: "2", gameId: game.gameId, from: "g2", to: "g4", positionRevision: game.positionRevision },
        now + 3000,
      );
      expect(result).toHaveProperty("game");
      if ("game" in result) game = result.game;

      // 2... Qh4# (checkmate)
      result = applyBotMove(game, { from: "d8", to: "h4" }, now + 4000);

      expect(result).toHaveProperty("game");
      if ("game" in result) {
        expect(result.game.status).toBe("checkmate");
        expect(result.game.winner).toBe("bot");
        expect(result.game.terminationReason).toContain("bot wins");
      }
    });

    it("detects insufficient material draw", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      let game = state.games[playerId];

      // Set up K vs K position - insufficient material
      game = {
        ...game,
        fen: "8/8/8/4k3/8/8/3K4/8 w - - 0 1",
        sideToMove: "white",
      };

      // Any move will trigger insufficient material detection
      const result = applyChessMove(
        game,
        { kind: "chess-move", requestId: "1", gameId: game.gameId, from: "d2", to: "d3", positionRevision: game.positionRevision },
        now + 1000,
      );

      expect(result).toHaveProperty("game");
      if ("game" in result) {
        expect(result.game.status).toBe("insufficient-material");
        expect(result.game.winner).toBe("draw");
      }
    });
  });

  describe("resignGame", () => {
    it("marks game as resigned", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = state.games[playerId];

      const resigned = resignGame(game, now + 5000);

      expect(resigned.status).toBe("resignation");
      expect(resigned.winner).toBe("bot");
      expect(resigned.terminatedAt).toBe(now + 5000);
    });
  });

  describe("calculateChessScore", () => {
    it("awards 100 points for win", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = { ...state.games[playerId], winner: "player" as const };
      expect(calculateChessScore(game)).toBe(100);
    });

    it("awards 50 points for draw", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = { ...state.games[playerId], winner: "draw" as const };
      expect(calculateChessScore(game)).toBe(50);
    });

    it("awards 0 points for loss", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = { ...state.games[playerId], winner: "bot" as const };
      expect(calculateChessScore(game)).toBe(0);
    });

    it("awards 0 points for abort", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = { ...state.games[playerId], status: "aborted" as const };
      expect(calculateChessScore(game)).toBe(0);
    });
  });

  describe("projectGuestSnapshot", () => {
    it("includes game state without revealing future information", () => {
      const state = initializeChessRound(roundId, [playerId], now);
      const game = state.games[playerId];

      const snapshot = projectGuestSnapshot(game, false);

      expect(snapshot.gameId).toBe(game.gameId);
      expect(snapshot.fen).toBe(game.fen);
      expect(snapshot.playerColor).toBe("white");
      expect(snapshot.botColor).toBe("black");
      expect(snapshot.playerTimeMs).toBe(60_000);
      expect(snapshot.isGameOver).toBe(false);
      expect(snapshot.inCheck).toBe(false);
    });
  });

  describe("updateRoundAggregates", () => {
    it("counts games correctly", () => {
      const state = initializeChessRound(roundId, ["p1", "p2", "p3"], now);

      // Finish one game
      state.games["p1"] = { ...state.games["p1"], status: "checkmate", winner: "player" };

      const updated = updateRoundAggregates(state);

      expect(updated.gamesInProgress).toBe(2);
      expect(updated.gamesFinished).toBe(1);
      expect(updated.allGamesComplete).toBe(false);
    });

    it("detects all games complete", () => {
      const state = initializeChessRound(roundId, ["p1", "p2"], now);

      state.games["p1"] = { ...state.games["p1"], status: "checkmate", winner: "player" };
      state.games["p2"] = { ...state.games["p2"], status: "resignation", winner: "bot" };

      const updated = updateRoundAggregates(state);

      expect(updated.allGamesComplete).toBe(true);
      expect(updated.gamesInProgress).toBe(0);
      expect(updated.gamesFinished).toBe(2);
    });
  });
});
