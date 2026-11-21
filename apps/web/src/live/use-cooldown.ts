import { useCallback, useSyncExternalStore } from "react";
import { serverOffset } from "./server-clock";

/** The room's clock as best this phone knows it. */
export function serverNowMs(now = Date.now()): number {
  return now + (serverOffset(now) ?? 0);
}

/** Whole seconds left until `until` on the room clock, 0 once it has passed. */
export function cooldownSecondsLeft(until: number | null, now: number): number {
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1_000));
}

/**
 * Seconds left on a room-clock cooldown. It re-renders once a second, on the
 * second, and stops at zero, so a finished cooldown costs nothing.
 */
export function useCooldownSeconds(until: number | null): number {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (until === null) {
        return () => undefined;
      }
      let timer = 0;
      const schedule = () => {
        const left = until - serverNowMs();
        if (left <= 0) {
          return;
        }
        // A few milliseconds past the boundary so the ceiling has moved.
        timer = window.setTimeout(
          () => {
            changed();
            schedule();
          },
          (left % 1_000 || 1_000) + 15,
        );
      };
      schedule();
      return () => window.clearTimeout(timer);
    },
    [until],
  );
  return useSyncExternalStore(subscribe, () =>
    cooldownSecondsLeft(until, serverNowMs()),
  );
}
