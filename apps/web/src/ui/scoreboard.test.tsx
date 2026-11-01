import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { Scoreboard } from "./scoreboard";

const entries = Array.from({ length: 24 }, (_, i) => ({
  id: `player-${i}`,
  name: `Guest ${i + 1}`,
  place: i === 1 ? 1 : i + 1,
  points: 240 - i * 10,
}));

it("shows ten server-ordered entries, browses all pages and returns to the leaders", async () => {
  render(<Scoreboard entries={entries} />);
  const list = screen.getByRole("list", { name: "Scoreboard" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  expect(screen.queryByText("Guest 11")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Previous players" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  await screen.findByText("Guest 11");
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(10));
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  await screen.findByText("Guest 24");
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));
  expect(
    screen.getByRole("button", { name: "Next players" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Back to leaders" }));
  await screen.findByText("Guest 1");
  expect(screen.getByText("1–10 of 24")).toBeTruthy();
});

it("preserves ties and server order, and clamps a page after players leave", async () => {
  const view = render(<Scoreboard entries={entries} />);
  expect(screen.getAllByLabelText("Place 1")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  await screen.findByText("Guest 11");
  view.rerender(<Scoreboard entries={entries.slice(0, 3)} />);
  await screen.findByText("Guest 3");
  expect(screen.getByText("1–3 of 3")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next players" })).toBeNull();
  view.rerender(<Scoreboard entries={entries} />);
  expect(screen.getByText("1–10 of 24")).toBeTruthy();
});

it("keeps an empty scoreboard readable", () => {
  render(<Scoreboard entries={[]} />);
  expect(screen.getByText("The first scores will appear here.")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});
