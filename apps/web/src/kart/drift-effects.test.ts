import { expect, it } from "vitest";
import { driftPose, driftSparks, driftStrength } from "./drift-effects";
it("poses opposite slides symmetrically and bounds body yaw", () => {
  expect(driftPose(0, 20, -8, true, 1)).toBeCloseTo(-driftPose(0, 20, 8, true, -1));
  expect(Math.abs(driftPose(0, 0, 50, true, -1))).toBeLessThanOrEqual(0.45);
  expect(driftPose(0, 20, -8, false, 1)).toBe(0);
});
it("recycles bounded wheel sparks that grow with charge and stretch on boost", () => {
  const low = driftSparks(0.1, 1, 0, false, false),
    charged = driftSparks(0.1, 1, 1, false, false),
    boost = driftSparks(0.1, 1, 1, true, false);
  expect(low).toHaveLength(8);
  expect(charged[0]!.scale).toBeGreaterThan(low[0]!.scale);
  expect(boost[0]!.z).toBeGreaterThan(charged[0]!.z);
  expect(driftSparks(0.2, 1, 1, false, false)).not.toEqual(charged);
  expect(driftSparks(0.1, 0, 1, false, false).every((s) => s.scale === 0)).toBe(true);
});
it("eases emission in and out independently of frame rate", () => {
  let a = 0,
    b = 0;
  for (let i = 0; i < 60; i++) a = driftStrength(a, true, 1 / 60);
  for (let i = 0; i < 30; i++) b = driftStrength(b, true, 1 / 30);
  expect(a).toBeCloseTo(b, 8);
  expect(driftStrength(a, false, 0.1)).toBeLessThan(a);
  expect(driftStrength(0, true, 0)).toBe(0);
});
it("uses two stationary wheel glows with reduced motion", () => {
  expect(driftSparks(1, 1, 1, false, true)).toHaveLength(2);
  expect(driftSparks(1, 1, 1, false, true)).toEqual(driftSparks(2, 1, 1, false, true));
});
