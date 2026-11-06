import { isNeutralKartGrade, type KartLookPreset } from "@26/shared";
import type { GraphicsTier } from "./graphics";
import type { EnvironmentFrame } from "./look-environment";

export type KartLookFrame = EnvironmentFrame & {
  /** Accepted driving speed in metres per second; never raw local controls. */
  speed?: number;
  /** Accepted boost envelope, normalised from zero to one. */
  boost?: number;
};
const clamp = (value: number | undefined, maximum = 1) =>
  Math.max(0, Math.min(maximum, Number.isFinite(value) ? value! : 0));

/** One bounded colour pass. Depth effects are opt-in High showcase settings. */
export function kartLookPolicy(
  preset: KartLookPreset,
  tier: GraphicsTier,
  frame: KartLookFrame = {},
  depthAvailable = true,
) {
  const o = preset.optics;
  const decoration = preset.enabled && tier !== "low";
  const moving = decoration && !frame.reducedMotion && !frame.paused;
  const motion =
    clamp((clamp(frame.speed, 60) - 12) / 18) * 0.35 + clamp(frame.boost) * 0.65;
  const quality = tier === "high" ? 1 : 0.65;
  const depth = decoration && tier === "high" && depthAvailable;
  const optics = {
    wind: moving && o.wind.enabled ? o.wind.strength * motion * 0.06 : 0,
    chromatic:
      moving && o.chromatic.enabled
        ? o.chromatic.strength * motion * (tier === "high" ? 1.5 : 1)
        : 0,
    lensDirt: decoration && o.lensDirt.enabled ? o.lensDirt.strength : 0,
    bloom: decoration && o.bloom.enabled ? o.bloom.strength * quality : 0,
    bloomThreshold: o.bloom.threshold,
    ao: depth && o.ao.enabled ? o.ao.strength : 0,
    aoRadius: o.ao.radius,
    tiltShift:
      depth && !frame.reducedMotion && o.tiltShift.enabled ? o.tiltShift.strength : 0,
    focusDistance: o.tiltShift.focusDistance,
    focusRange: o.tiltShift.focusRange,
  };
  const usesDepth = optics.ao > 0 || optics.tiltShift > 0;
  const grading = !isNeutralKartGrade(preset);
  const optical =
    optics.wind > 0 ||
    optics.chromatic > 0 ||
    optics.lensDirt > 0 ||
    optics.bloom > 0 ||
    usesDepth;
  return {
    grading,
    postprocessing: grading || optical,
    optics,
    depth: usesDepth,
    // Worst-case texture reads per fragment: source, red/blue, four shared
    // bloom/blur neighbours and five shared AO/focus depth samples.
    textureSamples:
      grading || optical
        ? 1 +
          (optics.chromatic > 0 ? 2 : 0) +
          (optics.bloom > 0 || optics.tiltShift > 0 ? 4 : 0) +
          (usesDepth ? 5 : 0)
        : 0,
    maxEdge: tier === "low" ? 1024 : tier === "balanced" ? 1536 : 2048,
  };
}
