import { describe, expect, it } from "vitest";
import { mapGuessPoints, mapPinSchema, pinDistanceKm } from "@26/shared";

describe("map guessing", () => {
  it("measures the short path across the date line", () => {
    expect(pinDistanceKm({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeCloseTo(
      222.39,
      1,
    );
  });
  it("rejects invalid coordinates and gives more points to closer pins", () => {
    expect(mapPinSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(mapGuessPoints(0, 100)).toBe(100);
    expect(mapGuessPoints(693, 100)).toBe(50);
    expect(mapGuessPoints(8000, 100)).toBe(0);
  });
});
