import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChessBoard, type ChessBoardProps } from "./chess-board";
import { fenAfter } from "./board-model";

afterEach(cleanup);

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function board(props: Partial<ChessBoardProps> = {}) {
  const onMove = vi.fn();
  const onPremove = vi.fn();
  const onClearPremoves = vi.fn();
  const onChange = vi.fn();
  const base: ChessBoardProps = {
    fen: start,
    playerColor: "white",
    inCheck: false,
    sideToMove: "white",
    interactive: true,
    onMove,
    onPremove,
    onClearPremoves,
    onChange,
  };
  const view = render(<ChessBoard {...base} {...props} />);
  return {
    onMove,
    onPremove,
    onClearPremoves,
    onChange,
    view,
    redraw: (next: Partial<ChessBoardProps>) =>
      view.rerender(<ChessBoard {...base} {...props} {...next} />),
  };
}

const square = (name: RegExp | string) => screen.getByRole("button", { name });

it("draws all 64 squares with the pieces as artwork", () => {
  const { view } = board();
  expect(screen.getAllByRole("button")).toHaveLength(64);
  expect(square("e1 White King")).toBeTruthy();
  expect(square("d8 Black Queen")).toBeTruthy();
  const art = [...view.container.querySelectorAll(".chess-piece img")].map((image) =>
    image.getAttribute("src"),
  );
  expect(art).toHaveLength(32);
  expect(art).toContain("/assets/chess/pieces/wK.svg");
  expect(art).toContain("/assets/chess/pieces/bN.svg");
});

it("shows where a tapped piece may go, then sends the move", () => {
  const { onMove } = board();
  fireEvent.click(square("e2 White Pawn"));
  expect(square("e2 White Pawn").getAttribute("aria-pressed")).toBe("true");
  expect(square("e3").getAttribute("data-target")).toBe("move");
  expect(square("e4").getAttribute("data-target")).toBe("move");
  expect(square("e5").getAttribute("data-target")).toBeNull();
  fireEvent.click(square("e4"));
  expect(onMove).toHaveBeenCalledWith("e2", "e4");
});

it("does not send an illegal move, and lets the player change piece or put it down", () => {
  const { onMove } = board();
  fireEvent.click(square("e2 White Pawn"));
  fireEvent.click(square("e6"));
  expect(onMove).not.toHaveBeenCalled();
  expect(square("e2 White Pawn").getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(square("g1 White Knight"));
  expect(square("f3").getAttribute("data-target")).toBe("move");
  fireEvent.click(square("g1 White Knight"));
  expect(square("f3").getAttribute("data-target")).toBeNull();
  // The other side's pieces cannot be picked up.
  fireEvent.click(square("e7 Black Pawn"));
  expect(square("e7 Black Pawn").getAttribute("aria-pressed")).toBe("false");
});

it("marks a capture target differently from a quiet move", () => {
  board({ fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2" });
  fireEvent.click(square("e4 White Pawn"));
  expect(square("d5 Black Pawn").getAttribute("data-target")).toBe("capture");
  expect(square("e5").getAttribute("data-target")).toBe("move");
});

it("ignores taps when it is not the player's move", () => {
  const { onMove } = board({ interactive: false });
  fireEvent.click(square("e2 White Pawn"));
  fireEvent.click(square("e4"));
  expect(onMove).not.toHaveBeenCalled();
  expect(square("e2 White Pawn").getAttribute("aria-pressed")).toBe("false");
});

it("highlights the last move and reports what kind it was", () => {
  const { onChange, redraw } = board();
  expect(onChange).not.toHaveBeenCalled();
  redraw({ fen: fenAfter(start, "e2", "e4")!, sideToMove: "black" });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0]![0]).toMatchObject({
    kind: "move",
    move: { from: "e2", to: "e4" },
  });
  expect(square("e2").hasAttribute("data-last")).toBe(true);
  expect(square("e4 White Pawn").hasAttribute("data-last")).toBe(true);
  expect(square("d2 White Pawn").hasAttribute("data-last")).toBe(false);
});

it("lights the king that is in check", () => {
  board({
    fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    inCheck: true,
  });
  expect(square("e1 White King").hasAttribute("data-check")).toBe(true);
  expect(square("e8 Black King").hasAttribute("data-check")).toBe(false);
});

it("turns the board round for Black", () => {
  board({ playerColor: "black", sideToMove: "black", interactive: false });
  const names = screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
  expect(names[0]).toBe("h1 White Rook");
  expect(names[63]).toBe("a8 Black Rook");
});

it("queues premoves when waiting for the opponent, moves pieces on the virtual board, and highlights premove squares", () => {
  const { onMove, onPremove, onChange, redraw } = board({
    interactive: false,
    premovable: true,
    sideToMove: "black",
  });

  // Tapping e2 shows premove targets including diagonal captures d3 and f3
  fireEvent.click(square("e2 White Pawn"));
  expect(square("e4").getAttribute("data-target")).toBe("move");
  expect(square("d3").getAttribute("data-target")).toBe("capture");
  expect(square("f3").getAttribute("data-target")).toBe("capture");

  fireEvent.click(square("e4"));
  expect(onMove).not.toHaveBeenCalled();
  expect(onPremove).toHaveBeenCalledWith("e2", "e4");

  // Drawing the queued premove moves the pawn to e4 with data-premove and does not fire onChange sound
  redraw({
    interactive: false,
    premovable: true,
    sideToMove: "black",
    premoves: [{ from: "e2", to: "e4" }],
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(square("e2").hasAttribute("data-premove")).toBe(true);
  expect(square("e4 White Pawn").hasAttribute("data-premove")).toBe(true);

  // Chaining a second premove from the pawn's new virtual square e4 -> d5
  fireEvent.click(square("e4 White Pawn"));
  expect(square("d5").getAttribute("data-target")).toBe("capture");
  fireEvent.click(square("d5"));
  expect(onPremove).toHaveBeenLastCalledWith("e4", "d5");
});

it("clears queued premoves on empty-square tap, right-click, or Escape", () => {
  const { onClearPremoves } = board({
    interactive: false,
    premovable: true,
    sideToMove: "black",
    premoves: [{ from: "g1", to: "f3" }],
  });

  // Tapping an empty square clears premoves
  fireEvent.click(square("a3"));
  expect(onClearPremoves).toHaveBeenCalledTimes(1);

  // Right-clicking anywhere on the board clears premoves
  fireEvent.contextMenu(square("f3 White Knight"));
  expect(onClearPremoves).toHaveBeenCalledTimes(2);

  // Pressing Escape clears premoves
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClearPremoves).toHaveBeenCalledTimes(3);
});
