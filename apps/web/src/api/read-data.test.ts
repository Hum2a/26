import { afterEach, expect, it, vi } from "vitest";
import { publicResultsSchema } from "@26/shared";
import { readSection } from "./read-data";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("bounds a read whose server never responds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal!.addEventListener("abort", () => reject(new Error("Aborted"))),
        ),
    ),
  );
  const result = readSection("/api/test", publicResultsSchema);
  await vi.advanceTimersByTimeAsync(12_000);
  expect(await result).toEqual({
    error: "We couldn’t load this information. Check your connection and try again.",
  });
});
it.each(["malformed", "unauthorised"])(
  "never treats %s data as a report",
  async (kind) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            kind === "malformed"
              ? { state: "ready", secret: "private" }
              : { state: "ready" },
            { status: kind === "unauthorised" ? 401 : 200 },
          ),
        ),
    );
    const result = await readSection("/api/test", publicResultsSchema);
    expect(result).toHaveProperty("error");
    expect(JSON.stringify(result)).not.toContain("private");
  },
);
it("surfaces a JSON server failure message instead of a connection error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "misconfigured",
          message: "Authentication is not configured for this environment.",
        },
        { status: 503 },
      ),
    ),
  );
  expect(await readSection("/api/test", publicResultsSchema)).toEqual({
    error: "Authentication is not configured for this environment.",
  });
});
it("does not pretend a non-JSON failure is a connection drop", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })),
  );
  expect(await readSection("/api/test", publicResultsSchema)).toEqual({
    error: "This information is unavailable. Try again.",
  });
});
