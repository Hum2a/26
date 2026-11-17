import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChessRehearsal } from "./chess-rehearsal";
import { playingFixture } from "../admin/controls.test-support";
import type { ChessGameProps } from "./chess-game";
vi.mock("./chess-game", () => ({
  ChessGame: ({ snapshot, onMove, onResign, disabled }: ChessGameProps) => (
    <div>
      <p>Moves {snapshot.plyCount}</p>
      <button
        disabled={disabled}
        onClick={() => onMove("e2", "e4", undefined, snapshot.positionRevision)}
      >
        Move pawn
      </button>
      <button onClick={onResign}>Resign practice</button>
      <p>{snapshot.status}</p>
    </div>
  ),
}));
it("uses the real chess rules in an explicit isolated rehearsal and blocks moves while paused", () => {
  const view = render(<ChessRehearsal snapshot={playingFixture} />);
  fireEvent.click(screen.getByRole("button", { name: "Move pawn" }));
  expect(screen.getByText("Moves 1")).toBeTruthy();
  view.rerender(
    <ChessRehearsal
      snapshot={{ ...playingFixture, paused: true, serverNow: Date.now() }}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Move pawn" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  view.rerender(
    <ChessRehearsal snapshot={{ ...playingFixture, serverNow: Date.now() }} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Resign practice" }));
  expect(screen.getByText("resignation")).toBeTruthy();
});
