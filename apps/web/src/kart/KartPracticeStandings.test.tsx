import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { PracticeStanding } from "@26/shared";
import { KartPracticeStandings } from "./KartPracticeStandings";

const standings: PracticeStanding[] = [
  {
    playerId: "cpu-2",
    name: "CPU Drift Dev",
    number: 3,
    isPlayer: false,
    finished: false,
    timeMs: null,
    progress: 0.62,
    lapsDone: 0,
    place: 1,
  },
  {
    playerId: "solo",
    name: "You",
    number: 1,
    isPlayer: true,
    finished: false,
    timeMs: null,
    progress: 0.54,
    lapsDone: 0,
    place: 2,
  },
  {
    playerId: "cpu-1",
    name: "CPU Turbo Tess",
    number: 2,
    isPlayer: false,
    finished: false,
    timeMs: null,
    progress: 0.41,
    lapsDone: 0,
    place: 3,
  },
];

it("stays hidden when driving solo without bots", () => {
  const { container } = render(
    <KartPracticeStandings standings={[standings[1]!]} mode="free" />,
  );
  expect(container.innerHTML).toBe("");
});

it("shows live place, lap, slipstream and rivals during bot practice", () => {
  render(
    <KartPracticeStandings standings={standings} mode="free" slipstream="active" />,
  );
  expect(screen.getByLabelText("Race place").textContent).toBe("2nd/3");
  expect(screen.getByText("Lap 1")).toBeTruthy();
  expect(screen.getByText("Slipstream!")).toBeTruthy();
  expect(screen.getByText("▲ CPU Drift Dev")).toBeTruthy();
  expect(screen.getByText("▼ CPU Turbo Tess")).toBeTruthy();
});

it("renders final standings with finish times and racing progress", () => {
  render(
    <KartPracticeStandings
      finished
      mode="trial-1"
      standings={[
        { ...standings[0]!, finished: true, timeMs: 61250, progress: 1, place: 1 },
        { ...standings[1]!, finished: true, timeMs: 63500, progress: 1, place: 2 },
        { ...standings[2]!, finished: false, timeMs: null, progress: 0.88, place: 3 },
      ]}
    />,
  );
  expect(screen.getByRole("heading", { name: "Race standings" })).toBeTruthy();
  expect(screen.getByText("1st · CPU Drift Dev")).toBeTruthy();
  expect(screen.getByText("1:01.25")).toBeTruthy();
  expect(screen.getByText("2nd · You")).toBeTruthy();
  expect(screen.getByText("1:03.50")).toBeTruthy();
  expect(screen.getByText("Racing · 88%")).toBeTruthy();
});
