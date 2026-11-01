import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
import KartGameWrapper from "./KartGameWrapper";
afterEach(() => vi.restoreAllMocks());
const fullRoom = () =>
  projectKartRace(
    createKartRace(
      "fifty",
      Array.from({ length: 50 }, (_, i) => ({
        playerId: "p" + i,
        name: "Driver " + (i + 1),
      })),
    ),
    null,
    100,
  );
it("shows all 50 positions without overlapping labels or a WebGL dependency", () => {
  render(<KartGameWrapper race={fullRoom()} />);
  const map = screen.getByRole("img", { name: "Live race map: 50 drivers" });
  expect(map.querySelectorAll("[data-map-player]")).toHaveLength(50);
  expect(map.querySelectorAll(".kart-map-number")).toHaveLength(3);
  expect(document.querySelector("canvas")).toBeNull();
  expect(screen.getByText(/0 finished/)).toBeTruthy();
});
it("shows ten leaders and makes every driver reachable in pages of ten", () => {
  render(<KartGameWrapper race={fullRoom()} paused />);
  const seen = new Set<string>();
  for (let page = 0; page < 5; page++) {
    const list = screen.getByRole("list", { name: "Race leaders" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    for (let i = page * 10 + 1; i <= page * 10 + 10; i++) {
      expect(within(list).getByText("Driver " + i, { exact: true })).toBeTruthy();
      seen.add("Driver " + i);
    }
    if (page < 4) fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  }
  expect(seen.size).toBe(50);
  expect(
    screen.getByRole("button", { name: "Next players" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Back to leaders" }));
  expect(screen.getByText("1–10 of 50")).toBeTruthy();
});
it("keeps the chosen page stable while racing and allows browsing while paused", () => {
  const interval = vi.spyOn(window, "setInterval");
  const view = render(<KartGameWrapper race={fullRoom()} />);
  expect(interval.mock.calls.some((call) => call[1] === 4000)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Next players" }));
  view.rerender(<KartGameWrapper race={fullRoom()} paused />);
  expect(screen.getByText("11–20 of 50")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Previous players" }));
  expect(screen.getByText("1–10 of 50")).toBeTruthy();
});
