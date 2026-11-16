import { act, render, renderHook, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace, type LobbySnapshot } from "@26/shared";
import { raceCountdown, useRaceCountdown } from "./countdown";
import * as haptics from "../device/haptics";
import { KartCountdown } from "./KartCountdown";

const base = { phase: "prompt", paused: false, mode: "prompt-tail" as const };

it("counts 3-2-1 over the last three seconds of the prompt, then GO", () => {
  expect(raceCountdown({ ...base, remainingMs: 5_000 })).toBeNull();
  expect(raceCountdown({ ...base, remainingMs: 3_000 })).toBe(3);
  expect(raceCountdown({ ...base, remainingMs: 2_001 })).toBe(3);
  expect(raceCountdown({ ...base, remainingMs: 2_000 })).toBe(2);
  expect(raceCountdown({ ...base, remainingMs: 1 })).toBe(1);
  expect(raceCountdown({ ...base, remainingMs: 0 })).toBeNull();
  expect(
    raceCountdown({
      ...base,
      phase: "collect",
      remainingMs: 170_000,
      raceElapsedMs: 200,
    }),
  ).toBe("GO");
  expect(
    raceCountdown({
      ...base,
      phase: "collect",
      remainingMs: 170_000,
      raceElapsedMs: 1_200,
    }),
  ).toBeNull();
});

it("shows nothing when paused, switched off, or outside the start", () => {
  expect(raceCountdown({ ...base, remainingMs: 2000, enabled: false })).toBeNull();
  expect(raceCountdown({ ...base, remainingMs: 2_000, paused: true })).toBeNull();
  expect(raceCountdown({ ...base, remainingMs: 2_000, mode: "none" })).toBeNull();
  expect(raceCountdown({ ...base, phase: "intro", remainingMs: 2_000 })).toBeNull();
  expect(
    raceCountdown({ ...base, phase: "reveal", remainingMs: 2_000, raceElapsedMs: 0 }),
  ).toBeNull();
});

it("suppresses disconnect haptics and does not replay a beat when reconnecting", () => {
  const buzz = vi.spyOn(haptics, "buzz").mockImplementation(() => {});
  try {
    const snapshot = kartPrompt(1500);
    const view = render(
      <KartCountdown snapshot={snapshot} observedAt={Date.now()} haptics />,
    );
    expect(buzz).toHaveBeenCalledTimes(1);
    view.rerender(
      <KartCountdown
        snapshot={snapshot}
        observedAt={Date.now()}
        enabled={false}
        haptics
      />,
    );
    expect(
      document.querySelector(
        '.kart-countdown[data-active="false"][aria-hidden="true"]',
      ),
    ).toBeTruthy();
    expect(buzz).toHaveBeenCalledTimes(1);
    view.rerender(
      <KartCountdown snapshot={snapshot} observedAt={Date.now()} haptics />,
    );
    expect(buzz).toHaveBeenCalledTimes(1);
    view.rerender(
      <KartCountdown snapshot={kartPrompt(500)} observedAt={Date.now()} haptics />,
    );
    expect(buzz).toHaveBeenCalledTimes(2);
  } finally {
    buzz.mockRestore();
  }
});

it("expires GO with the existing phase clock even when no new race frame arrives", () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  try {
    const prompt = kartPrompt(45000);
    const snapshot = { ...prompt, phase: "collect" as const };
    const view = renderHook(() => useRaceCountdown(snapshot, 100000));
    expect(view.result.current).toBe("GO");
    act(() => vi.advanceTimersByTime(1250));
    expect(view.result.current).toBeNull();
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

function kartPrompt(
  remainingMs: number,
  settings?: { countdown: "none" },
): LobbySnapshot {
  const race = projectKartRace(
    createKartRace("count", [{ playerId: "a", name: "A" }]),
    "a",
    0,
  );
  return {
    phase: "prompt",
    paused: false,
    held: false,
    deadlineAt: 100_000 + remainingMs,
    serverNow: 100_000,
    play: {
      question: { kind: "kart" },
      kart: { ...race, ...(settings ? { settings } : {}) },
    },
  } as unknown as LobbySnapshot;
}

it("renders the beat from the room's clock and respects the host switch", () => {
  const view = render(
    <KartCountdown snapshot={kartPrompt(1_500)} observedAt={Date.now()} />,
  );
  expect(screen.getByText("2")).toBeTruthy();
  view.rerender(
    <KartCountdown
      snapshot={kartPrompt(1_500, { countdown: "none" })}
      observedAt={Date.now()}
    />,
  );
  expect(
    document
      .querySelector(".kart-countdown span[data-beat]")
      ?.getAttribute("data-beat"),
  ).not.toBe("1");
});
