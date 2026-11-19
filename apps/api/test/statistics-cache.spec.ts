import { describe, expect, it } from "vitest";
import { StatisticsCache, statisticsMaxAgeMs } from "../src/stats/statistics-cache.ts";

function counting() {
  let builds = 0;
  const cache = new StatisticsCache<number>();
  const read = (questionIndex: number, phase: string, now: number, force = false) =>
    cache.read({ questionIndex, phase }, now, () => ++builds, force);
  return { cache, read, builds: () => builds };
}

describe("room statistics reuse", () => {
  it("reuses one build for a burst of broadcasts in the same phase", () => {
    const { read, builds } = counting();
    for (let n = 0; n < 80; n++) read(3, "vote", 1_000 + n * 30);
    expect(builds()).toBe(1);
  });

  it("rebuilds once the build is too old, the phase changes or the question changes", () => {
    const { read, builds } = counting();
    read(3, "collect", 0);
    read(3, "collect", statisticsMaxAgeMs - 1);
    expect(builds()).toBe(1);
    read(3, "collect", statisticsMaxAgeMs);
    expect(builds()).toBe(2);
    read(3, "reveal", statisticsMaxAgeMs + 1);
    expect(builds()).toBe(3);
    read(4, "reveal", statisticsMaxAgeMs + 2);
    expect(builds()).toBe(4);
  });

  it("always rebuilds in the lobby and at the end, where fun facts and the podium need every answer", () => {
    for (const phase of ["lobby", "final", "facts", "podium"]) {
      const { read, builds } = counting();
      read(41, phase, 0);
      read(41, phase, 1);
      expect(builds()).toBe(2);
    }
  });

  it("rebuilds for a forced read, a clock that went backwards, or after clearing", () => {
    const { cache, read, builds } = counting();
    read(3, "vote", 10_000);
    read(3, "vote", 10_001, true);
    expect(builds()).toBe(2);
    read(3, "vote", 9_000);
    expect(builds()).toBe(3);
    cache.clear();
    read(3, "vote", 9_001);
    expect(builds()).toBe(4);
  });

  it("returns the newest build after a forced read", () => {
    const { read } = counting();
    expect(read(3, "vote", 0)).toBe(1);
    expect(read(3, "vote", 1, true)).toBe(2);
    expect(read(3, "vote", 2)).toBe(2);
  });
});
