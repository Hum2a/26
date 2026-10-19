import { afterEach, expect, it, vi } from "vitest";
import { issueTransfer, lookupStage, playRoom } from "./room-api";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const input = {
  gameId: "ABCDEFGH",
  playerId: "00000000-0000-4000-8000-000000000001",
  requestId: "00000000-0000-4000-8000-000000000002",
};
it.each(["play", "transfer"])(
  "bounds %s requests and treats a lost response as uncertain",
  async (kind) => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener("abort", () => reject(new Error("Aborted"))),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const result =
      kind === "play" ? playRoom({ ...input, action: "pause" }) : issueTransfer(input);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await result).toMatchObject({ uncertain: true, error: expect.any(String) });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body as string).requestId).toBe(
      input.requestId,
    );
  },
);
it.each([200, 503, 403])(
  "classifies invalid command responses without inventing success (%i)",
  async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    expect(await playRoom({ ...input, action: "pause" })).toMatchObject({
      uncertain: status !== 403,
      error: expect.any(String),
    });
    expect(await issueTransfer(input)).toMatchObject({
      uncertain: status !== 403,
      error: expect.any(String),
    });
  },
);

it("releases projector lookup after a stalled connection", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal!.addEventListener("abort", () => reject(new Error("Aborted"))),
        ),
    ),
  );
  const result = lookupStage("ABCDEF");
  await vi.advanceTimersByTimeAsync(12_000);
  expect(await result).toEqual({
    error: "The projector could not connect. Check the room code and try again.",
  });
});
