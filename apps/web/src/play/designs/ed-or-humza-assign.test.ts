import { describe, expect, it } from "vitest";
import {
  assignQuote,
  countForTier,
  isLongQuote,
  lockSwipeAxis,
  nextUnassigned,
  swipeDecision,
  swipeProgress,
  unassignQuote,
  undoPlacements,
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

  it("commits both a fast flick and a slow drag on small and large phones", () => {
    // Fast flick: 40px in 65ms (~0.62 px/ms) commits on both 320px and 430px widths.
    expect(swipeDecision(-40, 5, 288, 65)).toBe("left");
    expect(swipeDecision(42, -4, 398, 70)).toBe("right");
    // Slow short drag of 40px does not commit.
    expect(swipeDecision(40, 0, 320, 400)).toBeNull();
    // Pause then flick at the end using recent pointer velocity still commits.
    expect(swipeDecision(36, 2, 390, 500, 0.65)).toBe("right");
    // Velocity pointing opposite the net displacement does not false-commit.
    expect(swipeDecision(40, 0, 320, 50, -0.8)).toBeNull();
    // Slow drag past threshold commits on narrow (288px) and wide (398px) cards.
    expect(swipeDecision(-68, 8, 288, 600)).toBe("left");
    expect(swipeDecision(92, -6, 398, 700)).toBe("right");
  });

  it("locks gesture axis cleanly after the deadzone so vertical scroll never fights swipes", () => {
    expect(lockSwipeAxis(4, 5)).toBeNull();
    expect(lockSwipeAxis(14, 4)).toBe("horizontal");
    expect(lockSwipeAxis(-12, 8)).toBe("horizontal");
    expect(lockSwipeAxis(5, 20)).toBe("vertical");
    expect(lockSwipeAxis(-8, -16)).toBe("vertical");
    expect(lockSwipeAxis(Number.NaN, 0)).toBeNull();
    expect(swipeDecision(Number.NaN, 0, 320)).toBeNull();
  });

  it("clamps drag progress and safely undoes without emptying base history", () => {
    expect(swipeProgress(0, 320)).toBe(0);
    expect(swipeProgress(500, 320)).toBe(1);
    expect(swipeProgress(-500, 320)).toBe(-1);

    const step1 = assignQuote([], "quote-01", "ed");
    const step2 = assignQuote(step1, "quote-02", "humza");
    const history = [[], step1, step2];
    expect(undoPlacements(history)).toEqual([[], step1]);
    expect(undoPlacements([[], step1])).toEqual([[]]);
    expect(undoPlacements([[]])).toEqual([[]]);

    expect(isLongQuote("Short line", 72)).toBe(false);
    expect(isLongQuote("x".repeat(73), 72)).toBe(true);
  });
});
