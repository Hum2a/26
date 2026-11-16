import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChessCapturedScore } from "./chess-captured";

it("shows running captured points during the game", () => {
  render(
    <ChessCapturedScore
      snapshot={{ capturedPoints: 13, score: 13, isGameOver: false }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Captured: 13 pts");
});

it("shows the final score after the game ends", () => {
  render(
    <ChessCapturedScore
      snapshot={{ capturedPoints: 1, score: 40, isGameOver: true }}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("Captured: 1 pts");
  expect(screen.getByRole("status").textContent).toContain("Final score: 40 pts");
});
