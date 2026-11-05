import { describe, expect, it } from "vitest";
import {
  boostCameraAmount,
  extrapolateKartPose,
  extrapolateLimitSeconds,
  kartCameraPose,
} from "./presentation";
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

describe("extrapolateKartPose", () => {
  it("carries a pose forward along its heading, bounded to a quarter second", () => {
    const pose = { x: 1, z: 2, heading: Math.PI / 2, height: 0 };
    const moved = extrapolateKartPose(pose, 10, 0.1);
    expect(moved.x).toBeCloseTo(1, 6);
    expect(moved.z).toBeCloseTo(3, 6);
    expect(moved.heading).toBe(pose.heading);
    expect(moved.height).toBe(0);
    const capped = extrapolateKartPose(pose, 10, 5);
    expect(capped.z).toBeCloseTo(2 + 10 * extrapolateLimitSeconds, 6);
    const reversing = extrapolateKartPose(pose, -4, 0.1);
    expect(reversing.z).toBeCloseTo(1.6, 6);
  });

  it("returns the pose unchanged for no time, no speed or bad numbers", () => {
    const pose = { x: 1, z: 2, heading: 0 };
    expect(extrapolateKartPose(pose, 10, 0)).toEqual(pose);
    expect(extrapolateKartPose(pose, 0, 0.2)).toEqual(pose);
    expect(extrapolateKartPose(pose, Number.NaN, 0.2)).toEqual(pose);
    expect(extrapolateKartPose(pose, 10, Number.NaN)).toEqual(pose);
    expect(extrapolateKartPose(pose, 10, -1)).toEqual(pose);
  });
});
