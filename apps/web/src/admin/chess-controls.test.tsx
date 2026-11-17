import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChessControls } from "./chess-controls";
vi.mock("./room-provider", () => ({
  useAdminRoom: () => ({
    snapshot: {
      play: {
        chess: {
          totalGames: 1,
          inProgress: 1,
          finished: 0,
          gameStatuses: [
            {
              playerId: "p",
              nickname: "Amina",
              status: "in-progress",
              plyCount: 4,
              playerTimeMs: 50000,
              botTimeMs: 58000,
              capturedPoints: 1,
              score: 1,
            },
          ],
          recentEvents: [],
        },
      },
    },
  }),
}));
it("shows each game’s clocks, capture points and a real rehearsal", () => {
  render(<ChessControls />);
  expect(screen.getByRole("region", { name: "Chess games" })).toBeTruthy();
  expect(
    screen.getByRole("row", { name: /Amina in-progress 4 50s 58s 1 1/ }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Rehearse against the real bot" })
      .getAttribute("href"),
  ).toBe("/chess");
});
