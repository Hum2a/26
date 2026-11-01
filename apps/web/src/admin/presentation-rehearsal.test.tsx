import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
vi.mock("../ui/activity-notices", () => ({ previewActivityToast: vi.fn() }));
import { previewActivityToast } from "../ui/activity-notices";
import { PresentationRehearsal } from "./presentation-rehearsal";
it("rehearses the real scoreboard, score changes and notification without a room", () => {
  render(<PresentationRehearsal />);
  expect(screen.getByText("1–10 of 100")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  expect(screen.getByText("11–20 of 100")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Preview score changes" }));
  expect(screen.getByText("Sample player 21")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Preview notification" }));
  expect(previewActivityToast).toHaveBeenCalledOnce();
});
