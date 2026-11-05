import { afterEach, expect, it, vi } from "vitest";
import { OutboundTimeout, withTimeout } from "../src/timeout";

afterEach(() => vi.useRealTimers());

it("passes through work that settles in time", async () => {
  await expect(withTimeout(Promise.resolve(7), "work", 50)).resolves.toBe(7);
  await expect(
    withTimeout(Promise.reject(new Error("no")), "work", 50),
  ).rejects.toThrow("no");
});

it("rejects hung work after the limit with a named error", async () => {
  vi.useFakeTimers();
  const pending = withTimeout(new Promise(() => {}), "Resend", 10_000);
  const assertion = expect(pending).rejects.toBeInstanceOf(OutboundTimeout);
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
});
