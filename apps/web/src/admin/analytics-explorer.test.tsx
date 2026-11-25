import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { AnalyticsExplorer } from "./analytics-explorer";
import { analyticsRehearsal } from "./analytics-rehearsal";

it("shows every guest for a question and lets the host explore a guest's whole game", () => {
  render(<AnalyticsExplorer data={analyticsRehearsal} rehearsal />);
  const question = screen.getByRole("table", { name: "Guest responses" });
  expect(within(question).getByText("Edinburgh")).toBeTruthy();
  expect(within(question).getByText("No response recorded")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Guests" }));
  fireEvent.change(screen.getByLabelText("Guest"), { target: { value: "sam" } });
  const guest = screen.getByRole("table", { name: "Responses by question" });
  expect(within(guest).getByText("Which city is furthest north?")).toBeTruthy();
  expect(within(guest).getByText("38 cm")).toBeTruthy();
  expect(within(guest).getByText("40 points")).toBeTruthy();
});
