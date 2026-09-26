import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./wakeLock";

async function flushLock(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useWakeLock", () => {
  it("requests a screen lock while active", async () => {
    renderHook(() => useWakeLock(true));
    await flushLock();
    expect(navigator.wakeLock.request).toHaveBeenCalledWith("screen");
  });

  it("releases when the lock becomes inactive", async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useWakeLock(active),
      { initialProps: { active: true } },
    );
    await flushLock();
    const sentinel = await vi.mocked(navigator.wakeLock.request).mock.results[0]?.value;
    rerender({ active: false });
    expect(sentinel?.release).toHaveBeenCalled();
  });

  it("releases on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await flushLock();
    const sentinel = await vi.mocked(navigator.wakeLock.request).mock.results[0]?.value;
    unmount();
    expect(sentinel?.release).toHaveBeenCalled();
  });

  it("re-requests when the page becomes visible", async () => {
    renderHook(() => useWakeLock(true));
    await flushLock();
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the Wake Lock API is missing", () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
