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
    postprocessing: true,
    depth: false,
    textureSamples: 1,
    optics: {
      wind: 0,
      chromatic: 0,
      lensDirt: 0,
      bloom: 0,
      bloomThreshold: 1,
      ao: 0,
      aoRadius: 3,
      tiltShift: 0,
      focusDistance: 25,
      focusRange: 18,
    },
    maxEdge: 1024,
  });
  expect(kartLookPolicy(kartLookPresets.warm, "balanced").maxEdge).toBe(1536);
  expect(kartLookPolicy(kartLookPresets.warm, "high").maxEdge).toBe(2048);
});
it("loads older version 1 exports with independent disabled optics and validates every optical range", () => {
  const old = JSON.parse(exportKartLookPreset(neutralKartLook));
  delete old.optics;
  const first = kartLookPresetSchema.parse(old);
  const second = kartLookPresetSchema.parse(old);
  expect(first.optics).toEqual(neutralKartLook.optics);
  for (const setting of Object.values(first.optics))
    expect(setting.enabled).toBe(false);
  first.optics.wind.enabled = true;
  expect(second.optics.wind.enabled).toBe(false);
  for (const [name, patch] of [
    ["wind", { strength: 1.01 }],
    ["chromatic", { strength: -0.01 }],
    ["lensDirt", { strength: 0.16 }],
    ["bloom", { strength: 0.36 }],
    ["bloom", { threshold: 0.49 }],
    ["ao", { strength: 0.26 }],
    ["ao", { radius: 7 }],
    ["tiltShift", { focusDistance: 0 }],
    ["tiltShift", { focusRange: Infinity }],
    ["wind", { remoteTexture: "https://example.com/private" }],
  ] as const) {
    const candidate = kartLookPresetSchema.parse(neutralKartLook);
    Object.assign(candidate.optics[name], patch);
    expect(kartLookPresetSchema.safeParse(candidate).success, name).toBe(false);
  }
});

it("uses only accepted speed/boost for restrained moving optics and applies explicit quality/reduced fallbacks", () => {
  const preset = kartLookPresetSchema.parse(neutralKartLook);
  for (const setting of Object.values(preset.optics)) setting.enabled = true;
  const stationary = kartLookPolicy(preset, "high");
  expect(stationary.optics.wind).toBe(0);
  expect(stationary.optics.chromatic).toBe(0);
  const fast = kartLookPolicy(preset, "high", { speed: 30, boost: 1 });
  expect(fast.optics.wind).toBeGreaterThan(0);
  expect(fast.optics.chromatic).toBeGreaterThan(0);
  expect(fast.depth).toBe(true);
  expect(fast.textureSamples).toBe(12);
  const clamped = kartLookPolicy(preset, "high", { speed: Infinity, boost: NaN });
  expect(clamped.optics.wind).toBe(0);
  expect(clamped.optics.chromatic).toBe(0);
  const reduced = kartLookPolicy(preset, "high", {
    speed: 30,
    boost: 1,
    reducedMotion: true,
  });
  expect(reduced.optics).toMatchObject({ wind: 0, chromatic: 0, tiltShift: 0 });
  expect(reduced.optics.ao).toBeGreaterThan(0);
  const paused = kartLookPolicy(preset, "high", { speed: 30, boost: 1, paused: true });
  expect(paused.optics).toMatchObject({ wind: 0, chromatic: 0 });
  const balanced = kartLookPolicy(preset, "balanced", { speed: 30, boost: 1 });
  expect(balanced.depth).toBe(false);
  expect(balanced.optics).toMatchObject({ ao: 0, tiltShift: 0 });
  expect(balanced.optics.bloom).toBeLessThan(fast.optics.bloom);
  expect(balanced.textureSamples).toBe(7);
  const low = kartLookPolicy(preset, "low", { speed: 30, boost: 1 });
  expect(low.postprocessing).toBe(false);
  expect(low.textureSamples).toBe(0);
  expect(low.depth).toBe(false);
  const unavailable = kartLookPolicy(preset, "high", {}, false);
  expect(unavailable.optics).toMatchObject({ ao: 0, tiltShift: 0 });
  const off = kartLookPolicy({ ...preset, enabled: false }, "high", {
    speed: 30,
    boost: 1,
  });
  expect(off.postprocessing).toBe(false);
});

it("enforces worst-case fragment and strength caps at every quality", () => {
  const preset = kartLookPresetSchema.parse(neutralKartLook);
  Object.assign(preset.optics, {
    wind: { enabled: true, strength: 1 },
    chromatic: { enabled: true, strength: 1 },
    lensDirt: { enabled: true, strength: 0.15 },
    bloom: { enabled: true, strength: 0.35, threshold: 0.5 },
    ao: { enabled: true, strength: 0.25, radius: 6 },
    tiltShift: { enabled: true, strength: 1, focusDistance: 120, focusRange: 60 },
  });
  for (const tier of ["low", "balanced", "high"] as const) {
    const policy = kartLookPolicy(preset, tier, { speed: 1_000, boost: 1_000 });
    expect(policy.textureSamples).toBeLessThanOrEqual(12);
    expect(policy.optics.wind).toBeLessThanOrEqual(0.06);
    expect(policy.optics.chromatic).toBeLessThanOrEqual(1.5);
    expect(policy.optics.bloom).toBeLessThanOrEqual(0.35);
    expect(policy.optics.ao).toBeLessThanOrEqual(0.25);
  }
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
