export type GraphicsMode = "auto" | "high" | "low";
export type GraphicsTier = "high" | "balanced" | "low";
export type FrameHealth = "checking" | "smooth" | "strained";

export function graphicsTier(
  mode: GraphicsMode,
  players: number,
  health: FrameHealth,
): GraphicsTier {
  if (mode !== "auto") return mode;
  if (players > 20 || health === "strained") return "low";
  return players > 15 ? "balanced" : "high";
}

export const graphicsProfiles = {
  high: { pixelRatio: 1.5, sparkStride: 1 },
  balanced: { pixelRatio: 1, sparkStride: 2 },
  low: { pixelRatio: 0.75, sparkStride: 4 },
} as const;

/** Actual visible frame cadence, not a device model or GPU fingerprint. */
export function createFrameProbe() {
  let began = 0,
    last = 0,
    samples = 0,
    slow = 0,
    windows = 0;
  return {
    reset() {
      began = last = samples = slow = windows = 0;
    },
    sample(now: number): FrameHealth | undefined {
      if (!began) {
        began = last = now;
        return;
      }
      const gap = now - last;
      last = now;
      // Ignore shader/model warm-up and background/suspended time.
      if (gap > 1000 || gap <= 0) {
        this.reset();
        return;
      }
      if (now - began < 2000) return;
      samples++;
      if (gap > 42) slow++;
      if (samples < 90) return;
      const strained = slow / samples > 0.2;
      samples = slow = 0;
      windows++;
      return strained ? "strained" : windows >= 2 ? "smooth" : undefined;
    },
  };
}
