import { z } from "zod";

export const kartHandlingSchema = z.enum(["slide-v1", "bounce-v1"]);
export type KartHandling = z.infer<typeof kartHandlingSchema>;
export const kartHandlingNames: Record<KartHandling, string> = {
  "slide-v1": "Original slide",
  "bounce-v1": "Arcade bounce",
};
/** Frozen v1 coefficients. A different feel needs a new named version. */
export const kartBounceTuning = {
  restitution: 0.22,
  minimumImpactSpeed: 4,
  stunMs: 180,
  cooldownMs: 600,
} as const;
export const kartHandlingHistorySchema = z
  .array(
    z
      .object({
        atMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        preset: kartHandlingSchema,
      })
      .strict(),
  )
  .max(20);
export type KartHandlingHistory = z.infer<typeof kartHandlingHistorySchema>;
export const kartHandlingControlSchema = z
  .object({
    next: kartHandlingSchema,
    current: kartHandlingSchema.optional(),
    frozen: z.boolean(),
  })
  .strict();
/** Only enough accepted state to seed this phone's cosmetic prediction. */
export const kartBounceViewSchema = z
  .object({
    preset: z.literal("bounce-v1"),
    stunMs: z.number().int().min(0).max(kartBounceTuning.stunMs),
    cooldownMs: z.number().int().min(0).max(kartBounceTuning.cooldownMs),
  })
  .strict();
