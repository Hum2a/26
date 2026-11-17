import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("../kart/KartCanvas", () => ({ default: () => <p>Stand-in WebGL surface</p> }));
import { KartRollbackBench } from "./kart-rollback-bench";

it("rehearses the real phone's pending and accepted device finish without a room", async () => {
  render(<KartRollbackBench />);
  fireEvent.click(screen.getByRole("button", { name: "Use lightweight map" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish line sample" }));
  await waitFor(() => expect(screen.getByText(/Sample device duration:/)).toBeTruthy());
  expect(screen.getByText(/awaiting sample receipt/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Accept sample finish" }));
  expect(screen.getByText("Chequered flag")).toBeTruthy();
  expect(screen.getByText(/sample receipt/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
  expect(screen.getByText("Drive locally between sample frames.")).toBeTruthy();
});
