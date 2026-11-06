import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartTrial } from "@26/shared";
import { KartTimeTrial } from "./KartTimeTrial";
import { trialTime } from "./trial-time";
const state = createKartTrial({
  version: 1,
  track: "mario-circuit-v1",
  physics: "arcade-v2",
  handling: "slide-v1",
  laps: 1,
  assists: "none",
  items: false,
  course: { boosts: false, ramps: false, hazards: false },
});
it("shows actual waiting, paused, assisted and invalid state without starting a clock", () => {
  const view = render(
    <KartTimeTrial trial={state} paused={false} onRestart={() => {}} />,
  );
  expect(screen.getByText("Cross the timing line ahead to start")).toBeTruthy();
  expect(screen.getByLabelText("Trial time").textContent).toBe("0:00.00");
  view.rerender(
    <KartTimeTrial
      trial={{ ...state, quality: "assisted" }}
      paused
      onRestart={() => {}}
    />,
  );
  expect(screen.getByText("Assisted run")).toBeTruthy();
  view.rerender(
    <KartTimeTrial
      trial={{ ...state, quality: "invalid" }}
      paused
      onRestart={() => {}}
    />,
  );
  expect(screen.getByText("Invalid run — no record")).toBeTruthy();
  expect(document.querySelector('[data-state="paused"]')).toBeTruthy();
  expect(trialTime(65432)).toBe("1:05.43");
  expect(trialTime(59999)).toBe("0:59.99");
  expect(trialTime(60000)).toBe("1:00.00");
});
it("renders real split results and restarts only on request", () => {
  const restart = vi.fn();
  render(
    <KartTimeTrial
      trial={{
        ...state,
        finished: true,
        elapsedMs: 24000,
        laps: [{ timeMs: 24000, sectorsMs: Array(8).fill(3000), quality: "clean" }],
      }}
      paused
      onRestart={restart}
    />,
  );
  expect(screen.getByLabelText("Lap splits").textContent).toContain("Lap 1: 0:24.00");
  expect(screen.getByText("Total 0:24.00 · Best lap 0:24.00")).toBeTruthy();
  expect(restart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Restart trial" }));
  expect(restart).toHaveBeenCalledTimes(1);
});
