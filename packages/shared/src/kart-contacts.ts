import { z } from "zod";

export const kartContactEventSchema = z
  .object({
    eventId: z.number().int().min(0).max(18_000_100),
    atMs: z.number().int().min(0).max(180_000),
    playerId: z.string().min(1).max(120),
  })
  .strict();
export type KartContactEvent = z.infer<typeof kartContactEventSchema>;

/** Control-only recent accepted impacts/recoveries. No raw inputs or device data. */
export const kartContactHistoryEntrySchema = kartContactEventSchema
  .extend({
    kind: z.enum(["impact", "recovery"]),
    number: z.number().int().min(1).max(100),
    x: z.number().finite(),
    z: z.number().finite(),
    speed: z.number().finite().min(0).max(1000),
  })
  .strict();
export const kartContactHistorySchema = z.array(kartContactHistoryEntrySchema).max(20);
export type KartContactHistoryEntry = z.infer<typeof kartContactHistoryEntrySchema>;

export function appendKartContactHistory(
  rows: readonly KartContactHistoryEntry[] | undefined,
  entry: KartContactHistoryEntry,
) {
  if (rows?.some((row) => row.eventId === entry.eventId && row.kind === entry.kind))
    return [...rows];
  return [...(rows ?? []), entry]
    .sort(
      (a, b) => a.atMs - b.atMs || a.eventId - b.eventId || (a.kind < b.kind ? -1 : 1),
    )
    .slice(-20);
}
