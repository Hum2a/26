import { useEffect } from "react";

/**
 * Holds a screen wake lock while `active` is true.
 * Re-requests when the page becomes visible again. Missing APIs do nothing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return () => {};
    }
    const locks = navigator.wakeLock;
    if (!locks || typeof locks.request !== "function") {
      return () => {};
    }

    let cancelled = false;
    let sentinel: WakeLockSentinel | undefined;

    async function acquire() {
      try {
        const next = await locks.request("screen");
        if (cancelled) {
          await next.release();
          return;
        }
        const previous = sentinel;
        sentinel = next;
        if (previous && previous !== next) {
          await previous.release();
        }
      } catch {
        // Denied, unsupported, or the page is hidden.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [active]);
}
