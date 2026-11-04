import { z } from "zod";

export const kartPresentationSchema = z
  .object({
    version: z.literal(1),
    assetVersion: z.literal("kart-assets-v1"),
    events: z
      .array(
        z
          .object({
            eventId: z.number().int().min(0).max(18_000_100),
            atMs: z.number().int().min(0).max(180_000),
            kind: z.literal("finish"),
            playerId: z.string().min(1).max(120),
            status: z.enum(["FINISHED", "DNF"]),
          })
          .strict(),
      )
      .max(32),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.events.some(
        (event, i) => i > 0 && event.eventId <= value.events[i - 1]!.eventId,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Events must have increasing unique eventIds.",
      });
  });
export type KartPresentation = z.infer<typeof kartPresentationSchema>;

/** Stable cosmetic finish IDs derive from frozen grid numbers and accepted times. */
export function kartFinishPresentation(race: {
  elapsedMs: number;
  ended: boolean;
  drivers: readonly {
    playerId: string;
    number: number;
    status: "RACING" | "FINISHED" | "DNF";
    lapTimeMs: number | null;
  }[];
}): KartPresentation | undefined {
  const events: KartPresentation["events"] = race.drivers
    .flatMap((driver) => {
      if (driver.status === "RACING") return [];
      if (driver.lapTimeMs === null && !race.ended) return [];
      const atMs = Math.floor(driver.lapTimeMs ?? race.elapsedMs);
      return [
        {
          eventId: atMs * 100 + driver.number,
          atMs,
          kind: "finish" as const,
          playerId: driver.playerId,
          status: driver.status,
        },
      ];
    })
    .sort((a, b) => a.eventId - b.eventId)
    .slice(-32);
  return events.length
    ? kartPresentationSchema.parse({
        version: 1,
        assetVersion: "kart-assets-v1",
        events,
      })
    : undefined;
}

/** Owned by one renderer's lifecycle, not a transport or gameplay store. */
export function readFreshKartEvents(
  raceId: string,
  value: unknown,
  cursor: { raceId: string; eventId: number } | null,
) {
  if (value === undefined)
    return {
      cursor: cursor?.raceId === raceId ? cursor : { raceId, eventId: -1 },
      events: [],
    };
  const parsed = kartPresentationSchema.safeParse(value);
  if (!parsed.success) return { cursor, events: [] };
  const newest = parsed.data.events.at(-1)?.eventId ?? -1;
  // First snapshot/reconnect/race change establishes a baseline, never a fresh celebration.
  if (!cursor || cursor.raceId !== raceId)
    return { cursor: { raceId, eventId: newest }, events: [] };
  return {
    cursor: { raceId, eventId: Math.max(cursor.eventId, newest) },
    events: parsed.data.events.filter((event) => event.eventId > cursor.eventId),
  };
}
