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
  expect(await result).toMatchObject({ error: expect.any(String) });
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
