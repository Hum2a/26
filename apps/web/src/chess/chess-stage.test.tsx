import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ChessStageSnapshot } from "@26/shared";
import { ChessStage } from "./chess-stage";

vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

const amina = "00000000-0000-4000-8000-000000000001";
const bilal = "00000000-0000-4000-8000-000000000002";

const snapshot: ChessStageSnapshot = {
  totalGames: 2,
  inProgress: 1,
  finished: 1,
  results: { playerWins: 1, botWins: 0, draws: 0, aborts: 0 },
  recentEvents: [
    {
      playerId: amina,
      nickname: "Amina",
      event: "checkmate-win",
      timestamp: 1,
      capturedPoints: 12,
      score: 40,
    },
  ],
  standings: [
    {
      playerId: amina,
      nickname: "Amina",
      capturedPoints: 12,
      score: 40,
      finished: true,
    },
    {
      playerId: bilal,
      nickname: "Bilal",
      capturedPoints: 5,
      score: 5,
      finished: false,
    },
  ],
};

it("shows the hall: totals, the points table and recent finishes, never a board", () => {
  const view = render(<ChessStage snapshot={snapshot} />);
  expect(screen.getByRole("heading", { name: "Chess Round" })).toBeTruthy();
  expect(screen.getByText("Playing").parentElement?.textContent).toContain("1");
  expect(screen.getByText("Beat the bot").parentElement?.textContent).toContain("1");
  expect(screen.queryByText("Aborted")).toBeNull();

  const table = screen.getByRole("region", { name: "Captured points" });
  const rows = within(table).getAllByRole("listitem");
  expect(rows[0]!.textContent).toContain("Amina");
  expect(rows[0]!.textContent).toContain("40 pts");
  expect(rows[1]!.textContent).toContain("Captured: 5 pts");

  const finishes = screen.getByRole("region", { name: "Recent finishes" });
  expect(finishes.textContent).toContain("Amina");
  expect(finishes.textContent).toContain("Checkmate! · 40 pts");

  // Aggregate only: no squares and no host-only board list on the projector.
  expect(view.container.querySelector(".chess-square")).toBeNull();
  expect(screen.queryByRole("region", { name: "Boards" })).toBeNull();
});
