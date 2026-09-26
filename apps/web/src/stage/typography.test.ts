import { describe, expect, it } from "vitest";
import { contrastRatio, stagePairPasses, stagePairs, stageSizes } from "./tokens";

describe("stage typography", () => {
  it("keeps body, question, and timer type at the projector minimums", () => {
    expect(stageSizes.body).toBeGreaterThanOrEqual(40);
    expect(stageSizes.question).toBeGreaterThanOrEqual(72);
    expect(stageSizes.timer).toBeGreaterThanOrEqual(120);
  });

  it("keeps every text and background pair at 7:1 or better", () => {
    expect(stagePairs.length).toBeGreaterThan(0);
    for (const pair of stagePairs) {
      expect(stagePairPasses(pair), pair.name).toBe(true);
      expect(contrastRatio(pair.text, pair.background)).toBeGreaterThanOrEqual(7);
    }
  });
});
