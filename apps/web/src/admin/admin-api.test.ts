import { afterEach, expect, it, vi } from "vitest";
import {
  confirmMagicLink,
  fetchAdminSession,
  requestMagicLink,
  signOutAdmin,
} from "./admin-api";

afterEach(() => {
  vi.useRealTimers();
});

it("returns a recoverable error for offline and malformed responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(Response.json({ unexpected: true })),
  );
  expect(await fetchAdminSession()).toHaveProperty("error");
  expect(await requestMagicLink("admin@example.test")).toHaveProperty("error");
  expect(await confirmMagicLink("token")).toHaveProperty("error");
});

it("times out an unresponsive session request", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new Error("timeout")));
        }),
    ),
  );
  const request = fetchAdminSession();
  await vi.advanceTimersByTimeAsync(12_000);
  expect(await request).toHaveProperty("error");
});

it("surfaces a rejected sign out", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
  expect(await signOutAdmin()).toHaveProperty("error");
});
