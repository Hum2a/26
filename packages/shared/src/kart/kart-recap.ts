import { z } from "zod";

export const kartEndReasonSchema = z.enum([
  "all-finished",
  "time-limit",
  "host-ended",
  "race-ended",
]);
export type KartEndReason = z.infer<typeof kartEndReasonSchema>;
const activeMs = z.number().int().nonnegative().max(180_000);
export const kartRecapSchema = z
  .object({
    version: z.literal(1),
    reason: z.union([z.literal("racing"), kartEndReasonSchema]),
    updatedAtMs: activeMs,
    drivers: z
      .array(
        z
          .object({
            playerId: z.string().min(1).max(120),
            number: z.number().int().min(1).max(100),
            status: z.enum(["RACING", "FINISHED", "DNF"]),
            checkpoint: z.number().int().min(0).max(8),
            lapTimeMs: activeMs.nullable(),
            sectorsMs: z.array(activeMs.nullable()).max(8),
            recoveries: z.number().int().nonnegative().max(1000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type KartRecap = z.infer<typeof kartRecapSchema>;

/** Accepted history, not a live clock. Stable between crossings/recoveries/finish. */
export function kartRaceRecap(race: {
  recapVersion?: 1;
  endReason?: KartEndReason;
  ended: boolean;
  elapsedMs: number;
  timeLimitMs?: number;
  drivers: readonly {
    playerId: string;
    number: number;
    status: "RACING" | "FINISHED" | "DNF";
    checkpoint: number;
    lapTimeMs: number | null;
    lastRecoveryAt?: number;
    lap?: { crossingsMs: (number | null)[]; recoveries: number };
  }[];
}): KartRecap | undefined {
  if (race.recapVersion !== 1) return undefined;
  return kartRecapSchema.parse({
    version: 1,
    reason: !race.ended
      ? "racing"
      : (race.endReason ??
        (race.elapsedMs >= (race.timeLimitMs ?? 45000) ? "time-limit" : "race-ended")),
    updatedAtMs: race.ended
      ? race.elapsedMs
      : Math.max(
          0,
          ...race.drivers.map((driver) =>
            Math.max(
              driver.lapTimeMs ?? 0,
              driver.lap?.crossingsMs.at(-1) ?? 0,
              driver.lastRecoveryAt ?? 0,
            ),
          ),
        ),
    drivers: race.drivers.map((driver) => ({
      playerId: driver.playerId,
      number: driver.number,
      status: driver.status,
      checkpoint: driver.checkpoint,
      lapTimeMs: driver.lapTimeMs,
      sectorsMs: (driver.lap?.crossingsMs ?? [])
        .slice(0, driver.checkpoint)
        .map((at, index, all) =>
          at === null || (index > 0 && all[index - 1] === null)
            ? null
            : at - (all[index - 1] ?? 0),
        ),
      recoveries: driver.lap?.recoveries ?? 0,
    })),
  });
}
