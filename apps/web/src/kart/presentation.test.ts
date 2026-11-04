import { expect, it } from "vitest";
import { boostCameraAmount, kartCameraPose } from "./presentation";
it("eases a bounded boost framing response from accepted state and suppresses it for reduced motion", () => {
  const first = boostCameraAmount(0, true, 0.02, false);
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(1);
  expect(boostCameraAmount(first, false, 0.02, false)).toBeLessThan(first);
  expect(boostCameraAmount(1, true, 0.02, true)).toBe(0);
  expect(boostCameraAmount(NaN, true, Infinity, false)).toBe(0);
  const pose = { x: 10, z: 20, height: 3, heading: 0 };
  expect(kartCameraPose(pose, false, 1).position[0]).toBe(-1);
  expect(kartCameraPose(pose, true, 1)).toEqual(kartCameraPose(pose, true, 0));
});
