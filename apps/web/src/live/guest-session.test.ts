import { afterEach, expect, it, vi } from "vitest";
import { joinLobby, redeemTransfer, resumeGuest } from "./room-api";

afterEach(() => {
  vi.useRealTimers();
});

it("distinguishes a refused join from an uncertain response so reopening entry can be retried", async () => {
  const request = { code: "ABCDEF", nickname: "Amina", requestId: crypto.randomUUID() };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: "conflict", message: "The host has closed joining." },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ broken: true })),
  );
  expect(await joinLobby(request)).toMatchObject({ uncertain: false });
  expect(await joinLobby(request)).toMatchObject({ uncertain: true });
  expect(await joinLobby(request)).toMatchObject({ uncertain: true });
});

it.each(["join", "transfer"] as const)(
  "bounds a stalled %s without pretending it was rejected by the room",
  async (operation) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_path, options: RequestInit) =>
          new Promise((_resolve, reject) =>
            options.signal?.addEventListener("abort", () =>
              reject(new Error("timeout")),
            ),
          ),
      ),
    );
    const request = expect(
      operation === "join"
        ? joinLobby({
            code: "ABCDEF",
            nickname: "Amina",
            requestId: crypto.randomUUID(),
          })
        : redeemTransfer({
            joinCode: "ABCDEF",
            code: "RECOVER1",
            requestId: crypto.randomUUID(),
          }),
    ).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(12_000);
    await request;
  },
);

it("distinguishes a refused transfer from an uncertain transfer response", async () => {
  const input = {
    joinCode: "ABCDEF",
    code: "RECOVER1",
    requestId: crypto.randomUUID(),
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "expired", message: "Code expired" }, { status: 410 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ broken: true })),
  );
  expect(await redeemTransfer(input)).toMatchObject({ uncertain: false });
  expect(await redeemTransfer(input)).toMatchObject({ uncertain: true });
  expect(await redeemTransfer(input)).toMatchObject({ uncertain: true });
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
