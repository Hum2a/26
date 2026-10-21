import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sessionRetryDelaysMs, useAdminSession } from "./use-admin-session";

const signedOut = { signedIn: false };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps checking quietly while sign-in is unreachable, then shows the session", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("starting"))
      .mockRejectedValueOnce(new Error("starting"))
      .mockResolvedValueOnce(Response.json(signedOut)),
  );
  const { result } = renderHook(() => useAdminSession());
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(result.current.state).toBe("loading");
  await act(() => vi.advanceTimersByTimeAsync(sessionRetryDelaysMs[0]!));
  expect(result.current.state).toBe("loading");
  await act(() => vi.advanceTimersByTimeAsync(sessionRetryDelaysMs[1]!));
  expect(result.current.state).toBe("ready");
});

it("shows the message only after every quiet retry has failed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const { result } = renderHook(() => useAdminSession());
  for (const delay of [0, ...sessionRetryDelaysMs]) {
    expect(result.current.state).toBe("loading");
    await act(() => vi.advanceTimersByTimeAsync(delay));
  }
  expect(result.current.state).toBe("error");
});

it("does not retry a real refusal from the server", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: "misconfigured", message: "Not configured." },
        { status: 503 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useAdminSession());
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(result.current.state).toBe("error");
  expect(fetch).toHaveBeenCalledOnce();
});
