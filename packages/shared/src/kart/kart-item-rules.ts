import { z } from "zod";
import { kartItemSchema, kartLegacyItems, type KartItem } from "./kart-powers.ts";
import { kartProjectileEventSchema } from "./kart-projectiles.ts";
/**
 * "position": item boxes favour catch-up items for karts at the back and
 * defensive items for the leaders. Absent keeps the even, fixed rotation.
 */
const luck = z.literal("position").optional();
const expanded = z
  .object({
    version: z.literal(2),
    allowed: z
      .array(kartItemSchema)
      .max(7)
      .refine((items) => new Set(items).size === items.length, "Choose each item once"),
    luck,
  })
  .strict();
export const kartItemRulesSchema = z.union([
  z.object({ version: z.literal(1), luck }).strict(),
  expanded,
]);
export type KartItemRules = z.infer<typeof kartItemRulesSchema>;
export const originalKartItemRules: KartItemRules = { version: 1 };
export function allowedKartItems(rules?: KartItemRules): readonly KartItem[] {
  return rules?.version === 2 ? rules.allowed : kartLegacyItems;
}
export const kartItemRulesHistorySchema = z
  .array(
    z
      .object({ atMs: z.number().int().nonnegative(), rules: kartItemRulesSchema })
      .strict(),
  )
  .max(20);
export const kartItemsControlSchema = z
  .object({
    next: kartItemRulesSchema,
    current: kartItemRulesSchema.optional(),
    frozen: z.boolean(),
    spawning: z.boolean(),
    held: z
      .array(
        z
          .object({
            playerId: z.string().min(1).max(120),
            number: z.number().int().min(1).max(100),
            item: kartItemSchema,
          })
          .strict(),
      )
      .max(100),
    oils: z.number().int().min(0).max(64),
    projectiles: z.number().int().min(0).max(64),
    tracked: z.boolean(),
    history: z.array(kartProjectileEventSchema).max(20),
    rulesHistory: kartItemRulesHistorySchema,
  })
  .strict();
