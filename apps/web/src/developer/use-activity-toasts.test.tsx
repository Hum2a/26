import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RehearsalState } from "@26/shared";
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
}));
import { toast } from "sonner";
import { useActivityToasts } from "./use-activity-toasts";
const event = (id: number): RehearsalState["events"][number] => ({
  id,
  at: id,
  actor: `Bot ${id}`,
  kind: "answer",
  detail: "Answer received",
  status: "accepted",
  phase: "collect",
  questionId: "sample",
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("ignores history and duplicate snapshots, and batches new receipts", () => {
  vi.useFakeTimers();
  const view = renderHook(({ events, enabled }) => useActivityToasts(events, enabled), {
    initialProps: { events: [event(1)], enabled: true },
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(toast).not.toHaveBeenCalled();
  const events = Array.from({ length: 101 }, (_, i) => event(i + 1));
  view.rerender({ events, enabled: true });
  view.rerender({ events: [...events], enabled: true });
  act(() => vi.advanceTimersByTime(1000));
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(
    "100 answers accepted",
    expect.objectContaining({ toasterId: "admin-activity" }),
  );
  view.rerender({ events: [...events, event(102)], enabled: false });
  view.rerender({ events: [...events, event(102)], enabled: true });
  act(() => vi.advanceTimersByTime(1000));
  expect(toast).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(toast.dismiss).toHaveBeenCalled();
});
it("cancels pending messages on exit and reports server refusals as errors", () => {
  vi.useFakeTimers();
  const view = renderHook(({ events }) => useActivityToasts(events, true), {
    initialProps: { events: [event(1)] },
  });
  view.rerender({ events: [event(1), { ...event(2), status: "refused" }] });
  act(() => vi.advanceTimersByTime(1000));
  expect(toast.error).toHaveBeenCalledTimes(1);
  view.rerender({ events: [event(1), event(2), event(3)] });
  view.unmount();
  act(() => vi.advanceTimersByTime(1000));
  expect(toast).not.toHaveBeenCalled();
});

it("keeps refused actions visible when a burst contains many kinds of activity", () => {
  vi.useFakeTimers();
  const view = renderHook(({ events }) => useActivityToasts(events, true), {
    initialProps: { events: [event(1)] },
  });
  view.rerender({
    events: [
      event(1),
      { ...event(2), status: "refused" },
      ...(["host", "phase", "connection", "scenario", "check"] as const).map(
        (kind, index) => ({ ...event(index + 3), kind, status: "info" as const }),
      ),
      event(8),
    ],
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(toast.error).toHaveBeenCalledOnce();
  expect(toast).toHaveBeenCalledTimes(2);
});
