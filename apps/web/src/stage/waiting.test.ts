import { describe, expect, it } from "vitest";
import { waitingSummary } from "./waiting";

describe("waitingSummary", () => {
  it("turns a submission count and a player count into who is left and a percentage", () => {
    expect(waitingSummary(1, 4)).toEqual({ waiting: 3, percentage: 25 });
    expect(waitingSummary(0, 0)).toEqual({ waiting: 0, percentage: 0 });
    expect(waitingSummary(3, 0)).toEqual({ waiting: 0, percentage: 0 });
    expect(waitingSummary(4, 4)).toEqual({ waiting: 0, percentage: 100 });
    expect(waitingSummary(9, 4)).toEqual({ waiting: 0, percentage: 100 });
    expect(waitingSummary(0, 5)).toEqual({ waiting: 5, percentage: 0 });
  });
});
