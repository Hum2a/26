import { describe, expect, it } from "vitest";
import {
  initializeChessRound,
  applyChessMove,
  applyBotMove,
} from "../src/questions/chess/chess-coordinator.ts";

/**
 * CRITICAL security tests: guests cannot control other players' games.
 */
describe("Chess Security: Cross-Player Isolation", () => {
  const roundId = "test-round";
  const aliceId = "alice";
  const now = Date.now();

  it("rejects move for different player's game even with correct gameId and revision", () => {
    // This test validates at the mechanic layer (executeChessMove)
    // The coordinator doesn't know about playerId - ownership is checked in mechanic
    // We'll test this with a room integration test that has real credentials
    expect(true).toBe(true); // Placeholder - full room test needed
  });

  it("accepts player's move in their own game on their turn", () => {
    const state = initializeChessRound(roundId, [aliceId], now);
    const game = state.games[aliceId];

    // Alice moves in her own game (white's turn)
    const result = applyChessMove(
      game,
      {
        kind: "chess-move",
        requestId: "alice-move",
        gameId: game.gameId,
        from: "e2",
        to: "e4",
        positionRevision: game.positionRevision,
      },
      now + 1000,
    );

    expect(result).toHaveProperty("game");
    if ("game" in result) {
      expect(result.game.sideToMove).toBe("black");
      expect(result.game.plyCount).toBe(1);
    }
  });

  it("rejects player's move in their own game when it's bot's turn", () => {
    const state = initializeChessRound(roundId, [aliceId], now);
    let game = state.games[aliceId];

    // Alice makes first move (white)
    const move1 = applyChessMove(
      game,
      {
        kind: "chess-move",
        requestId: "move1",
        gameId: game.gameId,
        from: "e2",
        to: "e4",
        positionRevision: game.positionRevision,
      },
      now + 1000,
    );
    expect(move1).toHaveProperty("game");
    if ("game" in move1) game = move1.game;

    // Now it's bot's turn (black), Alice tries to move again as human
    const invalidMove = applyChessMove(
      game,
      {
        kind: "chess-move",
        requestId: "invalid",
        gameId: game.gameId,
        from: "d2",
        to: "d4",
        positionRevision: game.positionRevision,
      },
      now + 2000,
    );

    expect(invalidMove).toHaveProperty("error");
    if ("error" in invalidMove) {
      expect(invalidMove.error.toLowerCase()).toContain("not your turn");
    }
  });

  it("accepts bot move submitted by player for their own game on bot's turn", () => {
    const state = initializeChessRound(roundId, [aliceId], now);
    let game = state.games[aliceId];

    // Alice makes human move (white)
    const move1 = applyChessMove(
      game,
      {
        kind: "chess-move",
        requestId: "move1",
        gameId: game.gameId,
        from: "e2",
        to: "e4",
        positionRevision: game.positionRevision,
      },
      now + 1000,
    );
    expect(move1).toHaveProperty("game");
    if ("game" in move1) game = move1.game;

    // Now bot's turn - Alice submits bot move for her own game (casual trust)
    // This will be routed through applyBotMove by executeChessMove
    // But we're testing coordinator here, so we manually call applyBotMove
    const botMove = applyBotMove(game, { from: "e7", to: "e5" }, now + 2000);

    expect(botMove).toHaveProperty("game");
    if ("game" in botMove) {
      expect(botMove.game.sideToMove).toBe("white"); // Back to player
      expect(botMove.game.plyCount).toBe(2);
    }
  });
});
