import { describe, expect, it } from "vitest";
import {
  assignQuote,
  countForTier,
  nextUnassigned,
  swipeDecision,
  unassignQuote,
} from "./ed-or-humza-assign";

const items = [{ id: "quote-01" }, { id: "quote-02" }, { id: "quote-03" }];

describe("Ed or Humza assignment helpers", () => {
  it("assigns, replaces and returns quotes without layout work", () => {
    const first = assignQuote([], "quote-01", "ed");
    expect(first).toEqual([{ itemId: "quote-01", tierId: "ed" }]);
    const moved = assignQuote(first, "quote-01", "humza");
    expect(moved).toEqual([{ itemId: "quote-01", tierId: "humza" }]);
    expect(countForTier(moved, "humza")).toBe(1);
    expect(unassignQuote(moved, "quote-01")).toEqual([]);
    expect(nextUnassigned(items, first)?.id).toBe("quote-02");
    expect(
      nextUnassigned(items, [
        { itemId: "quote-01", tierId: "ed" },
        { itemId: "quote-02", tierId: "humza" },
        { itemId: "quote-03", tierId: "ed" },
      ]),
    ).toBeUndefined();
  });

  it("commits a horizontal swipe past the threshold and ignores vertical pans", () => {
    expect(swipeDecision(-80, 10, 320)).toBe("left");
    expect(swipeDecision(90, -8, 320)).toBe("right");
    expect(swipeDecision(20, 4, 320)).toBeNull();
    expect(swipeDecision(-40, -50, 320)).toBeNull();
  });
});
