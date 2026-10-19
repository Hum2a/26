import { afterEach, expect, it, vi } from "vitest";
import { resumeGuest } from "./room-api";

afterEach(() => {
  vi.useRealTimers();
});

it("distinguishes no guest session from a service failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 })),
  );
  expect(await resumeGuest()).toBeUndefined();
  await expect(resumeGuest()).rejects.toThrow("Guest session is unavailable.");
});

it("returns a validated guest session", async () => {
  const session = {
    gameId: "ABCDEFGHJKLM",
    joinCode: "ABCDEF",
    playerId: "e91796ed-4db9-41f4-b889-39d045b12154",
    nickname: "Amina",
    stateVersion: 1,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(session)));
  expect(await resumeGuest()).toEqual(session);
});

it("bounds the recovery check so joining can be retried", async () => {
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
  const request = expect(resumeGuest()).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(12_000);
  await request;
});
