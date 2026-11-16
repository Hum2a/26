import { expect, it } from "vitest";
import { applySoloMove, createSoloSnapshot } from "./solo-game";

it("scores an en passant capture as a pawn in solo practice", () => {
  let game = createSoloSnapshot(0);
  const moves = [
    ["e2", "e4"],
    ["a7", "a6"],
    ["e4", "e5"],
    ["d7", "d5"],
    ["e5", "d6"],
  ] as const;
  let now = 0;
  for (const [from, to] of moves) {
    now += 200;
    const next = applySoloMove(game, from, to, now);
    if ("error" in next) {
      throw new Error(next.error);
    }
    game = next;
  }
  expect(game.capturedPoints).toBe(1);
  expect(game.score).toBe(1);
});
