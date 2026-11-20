import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ChessStageSnapshot, LobbySnapshot } from "@26/shared";
import { ChessStage } from "./chess-stage";
import { StagePlay } from "../play/stage-play";
import { playingFixture } from "../admin/controls.test-support";

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

it("shows highlights and every board's progress when the room sends them", () => {
  render(
    <ChessStage
      snapshot={{
        ...snapshot,
        highlights: {
          roomCaptured: 17,
          queensTaken: 1,
          timeWins: 2,
          movesPlayed: 48,
          longestGame: { playerId: bilal, nickname: "Bilal", value: 31 },
          fastestWin: { playerId: amina, nickname: "Amina", value: 34_000 },
          biggestHaul: { playerId: amina, nickname: "Amina", value: 12 },
        },
        standings: snapshot.standings.map((row, index) => ({
          ...row,
          moves: 10 + index,
          timeLeftMs: index === 0 ? 30_000 : 4_000,
        })),
      }}
    />,
  );
  const highlights = screen.getByRole("region", { name: "Highlights" });
  expect(highlights.textContent).toContain("Queens taken");
  expect(highlights.textContent).toContain("Amina · 34s");
  expect(highlights.textContent).toContain("Bilal · 31 moves");
  const boards = screen.getByRole("region", { name: "Every board" });
  const tiles = within(boards).getAllByRole("listitem");
  expect(tiles[1]!.textContent).toContain("11 moves");
  expect(tiles[1]!.getAttribute("data-low")).toBe("true");
});

it("renders chess prompt on the projector during intro and prompt before boards open", () => {
  const chessPrompt: LobbySnapshot = {
    ...playingFixture,
    phase: "prompt",
    play: {
      ...playingFixture.play!,
      question: {
        kind: "chess",
        id: "chess-battle",
        index: 1,
        total: 1,
        prompt: "Play 1-minute blitz against the Humza bot!",
        instructions: "Capture Black pieces for points.",
        points: 40,
        illustrative: false,
        attribution: "never",
        presentation: "default",
        playerTimeMs: 60_000,
        botTimeMs: 60_000,
      },
      chess: undefined,
    },
  };
  const { rerender } = render(
    <StagePlay snapshot={{ ...chessPrompt, phase: "intro" }} />,
  );
  expect(screen.getByText("Play 1-minute blitz against the Humza bot!")).toBeTruthy();
  expect(screen.queryByText(/Unsupported question type/i)).toBeNull();

  rerender(<StagePlay snapshot={chessPrompt} />);
  expect(screen.getByText("Play 1-minute blitz against the Humza bot!")).toBeTruthy();
  expect(screen.getByText("Capture Black pieces for points.")).toBeTruthy();
  expect(screen.queryByText(/Unsupported question type/i)).toBeNull();
});
