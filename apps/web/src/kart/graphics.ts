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
  high: {
    pixelRatio: 1.5,
    sparkStride: 1,
    sparkLimit: 640,
    trailLimit: 32,
    nearbyLimit: 8,
  },
  balanced: {
    pixelRatio: 1,
    sparkStride: 2,
    sparkLimit: 320,
    trailLimit: 0,
    nearbyLimit: 4,
  },
  low: {
    pixelRatio: 0.75,
    sparkStride: 4,
    sparkLimit: 128,
    trailLimit: 0,
    nearbyLimit: 2,
  },
} as const;

/** Local capability limits can lower decoration; they never alter race state. */
export function safeGraphicsProfile(
  tier: GraphicsTier,
  capabilities: { webgl: boolean; maxTextureSize: number; pixelRatioLimit: number },
) {
  if (
    !capabilities.webgl ||
    !Number.isFinite(capabilities.maxTextureSize) ||
    capabilities.maxTextureSize < 512
  )
    return null;
  const effective = capabilities.maxTextureSize < 2048 ? "low" : tier;
  const ratio =
    Number.isFinite(capabilities.pixelRatioLimit) && capabilities.pixelRatioLimit > 0
      ? capabilities.pixelRatioLimit
      : 1;
  return {
    tier: effective,
    ...graphicsProfiles[effective],
    pixelRatio: Math.min(ratio, graphicsProfiles[effective].pixelRatio),
  };
}

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
