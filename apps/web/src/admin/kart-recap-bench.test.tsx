import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { KartRecapBench } from "./kart-recap-bench";
it("rehearses actual reducer results across phone, stage and host without guests", () => {
  render(<KartRecapBench />);
  expect(screen.getAllByRole("region", { name: "Race recap" })).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse host early end" }));
  expect(screen.getByRole("heading", { name: "Race ended" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse recovery" }));
  expect(screen.getAllByText(/Back to track 1 time/).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("combobox", { name: "Phone driver" }), {
    target: { value: "stand-in-b" },
  });
  expect(screen.getByRole("heading", { name: "Time’s up" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse older race" }));
  expect(screen.getAllByText(/not recorded for this older race/)).toHaveLength(3);
});
