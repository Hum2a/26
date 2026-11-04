import { isNeutralKartGrade, type KartLookPreset } from "@26/shared";
import type { GraphicsTier } from "./graphics";
/** Cosmetic only. Low still supports one grading pass without optional assets. */
export function kartLookPolicy(preset: KartLookPreset, tier: GraphicsTier) {
  return {
    grading: !isNeutralKartGrade(preset),
    maxEdge: tier === "low" ? 1024 : tier === "balanced" ? 1536 : 2048,
  };
}
