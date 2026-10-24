import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { roomFixture } from "../admin/room-fixture.test-support";
import { usePhaseCountdown } from "./use-phase-countdown";
import { resetServerClock } from "./server-clock";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetServerClock();
});

it("keeps one countdown interval across socket clock updates and stops when paused", () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const interval = vi.spyOn(window, "setInterval");
  const snapshot = {
    ...roomFixture,
    serverNow: 10_000,
    deadlineAt: 20_000,
    held: false,
    paused: false,
  };
  const { result, rerender, unmount } = renderHook(
    ({ view, observedAt }) => usePhaseCountdown(view, observedAt),
    { initialProps: { view: snapshot, observedAt: 10_000 } },
  );
  expect(interval).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(1000));
  rerender({ view: { ...snapshot, serverNow: 11_000 }, observedAt: 11_000 });
  expect(interval).toHaveBeenCalledTimes(1);
  expect(result.current?.remainingMs).toBe(9000);
  rerender({
    view: { ...snapshot, paused: true, remainingMs: 9000 },
    observedAt: 11_000,
  });
  expect(result.current?.label).toBe("Paused");
  expect(vi.getTimerCount()).toBe(0);
  unmount();
});

it("does no periodic work while waiting for the host", () => {
  vi.useFakeTimers();
  const interval = vi.spyOn(window, "setInterval");
  const { result } = renderHook(() =>
    usePhaseCountdown({ ...roomFixture, held: true, deadlineAt: 20_000 }, 10_000),
  );
  expect(result.current?.label).toBe("Waiting");
  expect(interval).not.toHaveBeenCalled();
});
