import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Live browser preference shared by theme chrome and canvas presentation adapters. */
export function usePrefersReducedMotion() {
  const media = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
  const subscribe = useCallback(
    (notify: () => void) => {
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [media],
  );
  return useSyncExternalStore(
    subscribe,
    () => media.matches,
    () => true,
  );
}
