import { z } from "zod";

export const kartHueBands = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "magenta",
] as const;
export const kartLookTones = ["accent", "highlight", "muted", "ink"] as const;
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const band = z
  .object({
    hue: finite(-30, 30),
    saturation: finite(-1, 1),
    lightness: finite(-0.25, 0.25),
  })
  .strict();
export const neutralKartEnvironment = {
  enabled: false,
  sky: true,
  sunElevation: 45,
  sunAzimuth: 25,
  intensity: 1.5,
  reflection: 0.25,
  shadows: false,
};
export const kartEnvironmentSchema = z
  .object({
    enabled: z.boolean(),
    sky: z.boolean(),
    sunElevation: finite(10, 80),
    sunAzimuth: finite(-180, 180),
    intensity: finite(0.2, 3),
    reflection: finite(0, 1),
    shadows: z.boolean(),
  })
  .strict();
const opticalSwitch = (maximum: number) =>
  z.object({ enabled: z.boolean(), strength: finite(0, maximum) }).strict();
export const neutralKartOptics = {
  wind: { enabled: false, strength: 0.4 },
  chromatic: { enabled: false, strength: 0.3 },
  lensDirt: { enabled: false, strength: 0.05 },
  bloom: { enabled: false, strength: 0.12, threshold: 1 },
  ao: { enabled: false, strength: 0.12, radius: 3 },
  tiltShift: {
    enabled: false,
    strength: 0.3,
    focusDistance: 25,
    focusRange: 18,
  },
};
export const kartOpticsSchema = z
  .object({
    wind: opticalSwitch(1),
    chromatic: opticalSwitch(1),
    lensDirt: opticalSwitch(0.15),
    bloom: opticalSwitch(0.35).extend({ threshold: finite(0.5, 3) }),
    ao: opticalSwitch(0.25).extend({ radius: finite(1, 6) }),
    tiltShift: opticalSwitch(1).extend({
      focusDistance: finite(4, 120),
      focusRange: finite(2, 60),
    }),
  })
  .strict();
export const kartLookPresetSchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    environment: kartEnvironmentSchema.default(neutralKartEnvironment),
    optics: kartOpticsSchema.default(() => kartOpticsSchema.parse(neutralKartOptics)),
    grading: z
      .object({
        enabled: z.boolean(),
        mixer: z.array(finite(-2, 2)).length(9),
        brightness: finite(-0.3, 0.3),
        contrast: finite(0.5, 1.5),
        exposure: finite(-2, 2),
        gamma: finite(0.5, 2),
        temperature: finite(-1, 1),
        tint: finite(-1, 1),
        hue: finite(-180, 180),
        saturation: finite(0, 2),
        vibrance: finite(-1, 1),
        splitAmount: finite(0, 0.3),
        splitBalance: finite(0.1, 0.9),
        shadows: z.enum(kartLookTones),
        highlights: z.enum(kartLookTones),
        hsl: z
          .object({
            red: band,
            orange: band,
            yellow: band,
            green: band,
            cyan: band,
            blue: band,
            purple: band,
            magenta: band,
          })
          .strict(),
        toneMapping: z.enum(["source", "linear", "reinhard", "aces", "agx"]),
      })
      .strict(),
  })
  .strict();
export type KartLookPreset = z.infer<typeof kartLookPresetSchema>;
export const neutralKartLook: KartLookPreset = {
  version: 1,
  enabled: true,
  environment: { ...neutralKartEnvironment },
  optics: kartOpticsSchema.parse(neutralKartOptics),
  grading: {
    enabled: true,
    mixer: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    brightness: 0,
    contrast: 1,
    exposure: 0,
    gamma: 1,
    temperature: 0,
    tint: 0,
    hue: 0,
    saturation: 1,
    vibrance: 0,
    splitAmount: 0,
    splitBalance: 0.5,
    shadows: "accent",
    highlights: "highlight",
    toneMapping: "source",
    hsl: {
      red: { hue: 0, saturation: 0, lightness: 0 },
      orange: { hue: 0, saturation: 0, lightness: 0 },
      yellow: { hue: 0, saturation: 0, lightness: 0 },
      green: { hue: 0, saturation: 0, lightness: 0 },
      cyan: { hue: 0, saturation: 0, lightness: 0 },
      blue: { hue: 0, saturation: 0, lightness: 0 },
      purple: { hue: 0, saturation: 0, lightness: 0 },
      magenta: { hue: 0, saturation: 0, lightness: 0 },
    },
  },
};
export const kartLookPresets = {
  neutral: neutralKartLook,
  daylight: {
    ...neutralKartLook,
    environment: { ...neutralKartEnvironment, enabled: true },
    grading: { ...neutralKartLook.grading, toneMapping: "aces" as const },
  },
  warm: {
    ...neutralKartLook,
    grading: { ...neutralKartLook.grading, temperature: 0.3, contrast: 1.05 },
  },
  crisp: {
    ...neutralKartLook,
    grading: { ...neutralKartLook.grading, contrast: 1.12, vibrance: 0.2 },
  },
  cool: {
    ...neutralKartLook,
    grading: { ...neutralKartLook.grading, temperature: -0.25, saturation: 0.9 },
  },
  race: {
    ...neutralKartLook,
    grading: { ...neutralKartLook.grading, vibrance: 0.08 },
    optics: {
      ...neutralKartLook.optics,
      wind: { enabled: true, strength: 0.25 },
      chromatic: { enabled: true, strength: 0.18 },
      bloom: { enabled: true, strength: 0.08, threshold: 1 },
    },
  },
} satisfies Record<string, KartLookPreset>;
export function isNeutralKartGrade(value: KartLookPreset) {
  const g = value.grading,
    n = neutralKartLook.grading;
  return (
    !value.enabled ||
    !g.enabled ||
    (g.toneMapping === "source" &&
      g.mixer.every((v, i) => v === n.mixer[i]) &&
      g.brightness === 0 &&
      g.contrast === 1 &&
      g.exposure === 0 &&
      g.gamma === 1 &&
      g.temperature === 0 &&
      g.tint === 0 &&
      g.hue === 0 &&
      g.saturation === 1 &&
      g.vibrance === 0 &&
      g.splitAmount === 0 &&
      kartHueBands.every((key) => Object.values(g.hsl[key]).every((v) => v === 0)))
  );
}
export const exportKartLookPreset = (value: unknown) =>
  JSON.stringify(kartLookPresetSchema.parse(value), null, 2);
