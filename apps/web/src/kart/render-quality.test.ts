import { expect, it } from "vitest";
import {
  exportKartLookPreset,
  isNeutralKartGrade,
  kartLookPresetSchema,
  kartLookPresets,
  neutralKartLook,
} from "@26/shared";
import { gradeKartColour } from "./look-grade";
import { kartLookPolicy } from "./look-policy";
it("bypasses neutral at every quality and bounds the grading target without optional assets", () => {
  for (const tier of ["low", "balanced", "high"] as const)
    expect(kartLookPolicy(neutralKartLook, tier).grading).toBe(false);
  expect(kartLookPolicy(kartLookPresets.warm, "low")).toEqual({
    grading: true,
    maxEdge: 1024,
  });
  expect(kartLookPolicy(kartLookPresets.warm, "balanced").maxEdge).toBe(1536);
  expect(kartLookPolicy(kartLookPresets.warm, "high").maxEdge).toBe(2048);
});
it("validates all named looks, rejects private/invalid shader parameters and clones imports", () => {
  for (const value of Object.values(kartLookPresets))
    expect(kartLookPresetSchema.parse(JSON.parse(exportKartLookPreset(value)))).toEqual(
      value,
    );
  for (const value of [
    { ...neutralKartLook, secret: "x" },
    { ...neutralKartLook, version: 2 },
    { ...neutralKartLook, grading: { ...neutralKartLook.grading, gamma: 0 } },
    { ...neutralKartLook, grading: { ...neutralKartLook.grading, mixer: [1, 2] } },
    { ...neutralKartLook, grading: { ...neutralKartLook.grading, exposure: Infinity } },
  ])
    expect(kartLookPresetSchema.safeParse(value).success).toBe(false);
  expect(isNeutralKartGrade(neutralKartLook)).toBe(true);
});
it("preserves neutral linear/HDR source samples exactly, and visibly grades actual channels", () => {
  for (const input of [
    [0, 0, 0],
    [0.1, 0.3, 0.7],
    [2, 4, 1],
  ] as [number, number, number][])
    expect(gradeKartColour(input, neutralKartLook, [0, 0, 0], [1, 1, 1])).toEqual(
      input,
    );
  const swap = {
    ...neutralKartLook,
    grading: { ...neutralKartLook.grading, mixer: [0, 0, 1, 0, 1, 0, 1, 0, 0] },
  };
  const actual = gradeKartColour([0.1, 0.3, 0.7], swap, [0, 0, 0], [1, 1, 1]);
  expect(actual[0]).toBeCloseTo(0.7);
  expect(actual[1]).toBeCloseTo(0.3);
  expect(actual[2]).toBeCloseTo(0.1);
  expect(
    gradeKartColour([0.1, 0.3, 0.7], kartLookPresets.warm, [0, 0, 0], [1, 1, 1]),
  ).not.toEqual([0.1, 0.3, 0.7]);
});
it("every per-hue control actually changes its colour band without producing invalid values", () => {
  const bands = [
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "blue",
    "purple",
    "magenta",
  ] as const;
  const samples = [
    [0.8, 0.1, 0.1],
    [0.8, 0.45, 0.1],
    [0.8, 0.8, 0.1],
    [0.1, 0.8, 0.1],
    [0.1, 0.8, 0.8],
    [0.1, 0.1, 0.8],
    [0.45, 0.1, 0.8],
    [0.8, 0.1, 0.8],
  ] as [number, number, number][];
  for (let i = 0; i < bands.length; i++)
    for (const field of ["hue", "saturation", "lightness"] as const) {
      const name = bands[i]!,
        look = kartLookPresetSchema.parse(neutralKartLook);
      look.grading.hsl[name][field] =
        field === "hue" ? 10 : field === "saturation" ? -0.2 : 0.1;
      const out = gradeKartColour(samples[i]!, look, [0.1, 0.2, 0.3], [0.8, 0.7, 0.4]);
      expect(out).not.toEqual(samples[i]);
      expect(out.every(Number.isFinite)).toBe(true);
    }
});
it("all global grading parameters affect the reference colour and stay finite", () => {
  const variants = {
    brightness: 0.1,
    contrast: 1.1,
    exposure: 0.5,
    gamma: 1.2,
    temperature: 0.4,
    tint: 0.3,
    hue: 20,
    saturation: 0.7,
    vibrance: 0.4,
    splitAmount: 0.2,
  };
  const sample: [number, number, number] = [0.7, 0.3, 0.2];
  for (const [key, value] of Object.entries(variants)) {
    const look = kartLookPresetSchema.parse({
      ...neutralKartLook,
      grading: { ...neutralKartLook.grading, [key]: value },
    });
    const out = gradeKartColour(sample, look, [0.1, 0.2, 0.3], [0.8, 0.7, 0.4]);
    expect(out, key).not.toEqual(sample);
    expect(out.every(Number.isFinite)).toBe(true);
  }
});
