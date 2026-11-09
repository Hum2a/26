import { z } from "zod";

export const kartVfxKinds = [
  "dust",
  "exhaust",
  "spark",
  "glow",
  "arc",
  "trail",
  "flame",
  "confetti",
] as const;
export type KartVfxKind = (typeof kartVfxKinds)[number];
export const kartVfxPresetSchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    mode: z.enum(["time", "burst"]),
    rate: z.number().finite().min(1).max(60),
    burstCount: z.number().int().min(1).max(32),
    lifetimeMs: z.number().int().min(100).max(3000),
    size: z.number().finite().min(0.1).max(2),
    gravity: z.number().finite().min(-4).max(4),
    fade: z.enum(["linear", "ease-out"]),
    renderMode: z.enum(["mesh", "billboard", "stretch"]),
    trailLength: z.number().finite().min(0).max(12),
    skidLifetimeMs: z.number().int().min(100).max(8000),
    effects: z
      .object({
        dust: z.boolean(),
        exhaust: z.boolean(),
        spark: z.boolean(),
        glow: z.boolean(),
        arc: z.boolean(),
        trail: z.boolean(),
        flame: z.boolean(),
        confetti: z.boolean(),
        skids: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type KartVfxPreset = z.infer<typeof kartVfxPresetSchema>;
export const defaultKartVfxPreset: KartVfxPreset = {
  version: 1,
  enabled: true,
  mode: "time",
  rate: 24,
  burstCount: 12,
  lifetimeMs: 700,
  size: 0.6,
  gravity: 0.5,
  fade: "ease-out",
  renderMode: "billboard",
  trailLength: 3,
  skidLifetimeMs: 4000,
  effects: {
    dust: true,
    exhaust: true,
    spark: true,
    glow: true,
    arc: true,
    trail: true,
    flame: true,
    confetti: true,
    skids: true,
  },
};

/** Presentation buffers only; gameplay hazards/items never share these pools. */
export const kartVfxBudgets = {
  high: { particles: 1024, skids: 256 },
  balanced: { particles: 512, skids: 128 },
  low: { particles: 128, skids: 64 },
} as const;

export function exportKartVfxPreset(value: unknown) {
  return JSON.stringify(kartVfxPresetSchema.parse(value), null, 2);
}
