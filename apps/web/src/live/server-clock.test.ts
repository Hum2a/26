import { afterEach, describe, expect, it } from "vitest";
import {
  deadlinePassed,
  noteServerTime,
  resetServerClock,
  serverOffset,
} from "./server-clock";

afterEach(() => resetServerClock());

describe("server clock", () => {
  it("has no offset until a round trip is measured", () => {
    expect(serverOffset(1_000)).toBeUndefined();
  });

  it("uses the fastest round trip, whose one-way error is smallest", () => {
    // Room clock is 5s ahead. A slow 800ms trip that went out fast and came back slow skews by 300ms.
    noteServerTime(1_000, 6_100, 1_800);
    noteServerTime(2_000, 7_020, 2_040);
    expect(serverOffset(2_100)).toBe(5_000);
  });

  it("ignores impossible samples", () => {
    noteServerTime(5_000, 1, 4_000);
    noteServerTime(0, 1, 20_000);
    expect(serverOffset(20_000)).toBeUndefined();
  });

  it("forgets samples after five minutes", () => {
    noteServerTime(1_000, 6_020, 1_040);
    expect(serverOffset(1_040 + 5 * 60_000 + 1)).toBeUndefined();
  });
});

describe("deadlinePassed", () => {
  const collect = { phase: "collect", paused: false, held: false, deadlineAt: 10_000 };

  it("defers to the room when the clock is not measured", () => {
    expect(deadlinePassed(collect, 999_999)).toBe(false);
  });

  it("locks an answer once the room's clock reaches the deadline", () => {
    noteServerTime(1_000, 1_520, 1_040); // Room is 500ms ahead.
    expect(deadlinePassed(collect, 9_400)).toBe(false);
    expect(deadlinePassed(collect, 9_500)).toBe(true);
  });

  it("never locks while paused, held or outside an answer phase", () => {
    noteServerTime(1_000, 1_520, 1_040);
    expect(deadlinePassed({ ...collect, paused: true }, 20_000)).toBe(false);
    expect(deadlinePassed({ ...collect, held: true }, 20_000)).toBe(false);
    expect(deadlinePassed({ ...collect, phase: "reveal" }, 20_000)).toBe(false);
  });
});
