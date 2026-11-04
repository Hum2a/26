import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./use-reduced-motion";
it("responds to preference changes while mounted and removes its listener", () => {
  let matches = false;
  const listeners = new Set<() => void>();
  const original = window.matchMedia;
  window.matchMedia = vi.fn(
    () =>
      ({
        get matches() {
          return matches;
        },
        addEventListener: (_kind: string, listener: () => void) =>
          listeners.add(listener),
        removeEventListener: (_kind: string, listener: () => void) =>
          listeners.delete(listener),
      }) as unknown as MediaQueryList,
  );
  try {
    const { result, unmount } = renderHook(usePrefersReducedMotion);
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(true);
    act(() => {
      matches = false;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
    unmount();
    expect(listeners.size).toBe(0);
  } finally {
    window.matchMedia = original;
  }
});
