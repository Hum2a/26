import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { KartTrialBench } from "./kart-trial-bench";
it("rehearses actual trial states and controls without a room or persistent storage", () => {
  localStorage.clear();
  render(<KartTrialBench />);
  expect(screen.getByText("Cross the timing line ahead to start")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse invalid" }));
  expect(screen.getByText("Invalid run — no record")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse assisted" }));
  expect(screen.getByText("Assisted run")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse finished" }));
  expect(screen.getByLabelText("Lap splits").children).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Restart trial" }));
  expect(screen.getByRole("button", { name: "Resume trial preview" })).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Save best times on this browser" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear local records" }));
  expect(localStorage.length).toBe(0);
  expect(screen.getByTitle("Time trial practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
});
