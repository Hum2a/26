import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
import KartGameWrapper from "./KartGameWrapper";

afterEach(() => vi.restoreAllMocks());
const fullRoom = () =>
  projectKartRace(
    createKartRace(
      "fifty",
      Array.from({ length: 50 }, (_, i) => ({
        playerId: `p${i}`,
        name: `Driver ${i + 1}`,
      })),
    ),
    null,
    100,
  );

it("shows all 50 positions without 50 overlapping labels or a WebGL dependency", () => {
  render(<KartGameWrapper race={fullRoom()} />);
  const map = screen.getByRole("img", { name: "Live race map: 50 drivers" });
  expect(map.querySelectorAll("[data-map-player]")).toHaveLength(50);
  expect(map.querySelectorAll(".kart-map-number")).toHaveLength(3);
  expect(document.querySelector("canvas")).toBeNull();
  expect(screen.getByText("50 drivers · 0 finished")).toBeTruthy();
});

it("keeps the five leaders visible and makes every other driver reachable", async () => {
  render(<KartGameWrapper race={fullRoom()} paused />);
  const leaders = screen.getByRole("list", { name: "Race leaders" });
  const seen = new Set<string>();
  for (let page = 0; page < 9; page++) {
    const start = 6 + page * 5;
    await screen.findByText(`Driver ${start}`, { exact: false, selector: "strong" });
    for (let i = start; i < start + 5; i++) {
      expect(
        within(screen.getByRole("list", { name: "Rest of the race field" })).getByText(
          `Driver ${i}`,
          { exact: false, selector: "strong" },
        ),
      ).toBeTruthy();
      seen.add(`Driver ${i}`);
    }
    expect(
      within(leaders).getByText("Driver 1", { exact: false, selector: "strong" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next drivers" }));
  }
  expect(seen.size).toBe(45);
});

it("cycles the field every four seconds and stops the display carousel when paused", async () => {
  const interval = vi.spyOn(window, "setInterval");
  const clear = vi.spyOn(window, "clearInterval");
  const view = render(<KartGameWrapper race={fullRoom()} />);
  const index = interval.mock.calls.findIndex((call) => call[1] === 4000);
  expect(index).toBeGreaterThanOrEqual(0);
  act(() => (interval.mock.calls[index]![0] as () => void)());
  await screen.findByText("The field · 11–15");
  view.rerender(<KartGameWrapper race={fullRoom()} paused />);
  expect(clear).toHaveBeenCalledWith(interval.mock.results[index]!.value);
});
