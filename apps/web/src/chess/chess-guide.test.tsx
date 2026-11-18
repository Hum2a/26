import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChessGuide } from "./chess-guide";

it("always shows what each Black piece is worth", () => {
  render(<ChessGuide />);
  const values = screen.getByRole("list", {
    name: "Points for each Black piece you capture",
  });
  const items = within(values).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "queen10",
    "rook5",
    "bishop3",
    "knight3",
    "pawn1",
  ]);
});

it("folds the scoring rules and tips away until asked, including the time-win bonus", () => {
  render(<ChessGuide />);
  expect(screen.queryByText(/Premove/)).toBeNull();
  const toggle = screen.getByRole("button", { name: /how to score/i });
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText(/your captures \+ 15 bonus/)).toBeTruthy();
  expect(screen.getByText(/Premove: queue moves/)).toBeTruthy();
});
