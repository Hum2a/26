import { z } from "zod";
import { kartRecapSchema } from "./kart-recap.ts";
import { kartItemSchema, type KartPowers } from "./kart-powers.ts";
import {
  kartProjectilePoseSchema,
  projectKartProjectiles,
  type KartProjectileWorld,
} from "./kart-projectiles.ts";
import { allowedKartItems, type KartItemRules } from "./kart-item-rules.ts";
import { kartContactEventSchema, type KartContactEvent } from "./kart-contacts.ts";
import {
  kartBounceViewSchema,
  kartBounceTuning,
  type KartHandling,
} from "./kart-handling.ts";

const finishEventsSchema = z
  .array(
    kartContactEventSchema
      .extend({
        kind: z.literal("finish"),
        status: z.enum(["FINISHED", "DNF"]),
      })
      .strict(),
  )
  .max(32)
  .refine(
    (events) =>
      events.every(
        (event, index) => index === 0 || event.eventId > events[index - 1]!.eventId,
      ),
    "Events must have increasing unique eventIds.",
  );
const presentationShape = {
  assetVersion: z.literal("kart-assets-v1"),
  events: finishEventsSchema,
};
export const kartPresentationV1Schema = z
  .object({
    ...presentationShape,
    version: z.literal(1),
    recap: kartRecapSchema.optional().catch(undefined),
  })
  .strict();
/** Version 2 adds only this phone's accepted contact; legacy readers drop this cosmetic envelope. */
export const kartPresentationV2Schema = z
  .object({
    ...presentationShape,
    version: z.literal(2),
    contacts: z.array(kartContactEventSchema).max(1),
    handling: kartBounceViewSchema.optional(),
  })
  .strict();
export const kartPresentationV3Schema = z
  .object({
    ...presentationShape,
    version: z.literal(3),
    recap: kartRecapSchema.optional(),
    contacts: z.array(kartContactEventSchema).max(1),
    handling: kartBounceViewSchema.optional(),
    items: z
      .object({
        version: z.literal(2),
        allowed: z.array(kartItemSchema).max(7),
        spawning: z.boolean(),
        heldItem: kartItemSchema.nullable(),
        projectiles: z.array(kartProjectilePoseSchema).max(64),
      })
      .strict(),
  })
  .strict();
/** Expanded gameplay requires protocol2; legacy readers can still parse the base race. */
export const kartPresentationSchema = z.union([
  kartPresentationV1Schema,
  kartPresentationV2Schema,
  kartPresentationV3Schema,
]);
export type KartPresentation = z.infer<typeof kartPresentationSchema>;

/** Shared by full snapshots and compact phone frames; no duplicate race projection. */
export function kartContactPresentation(
  race: {
    contactVersion?: 1;
    handling?: KartHandling;
    ended: boolean;
    drivers: readonly {
      playerId: string;
      status: string;
      lastImpact?: KartContactEvent;
      physics?: { stunMs?: number; impactCooldownMs?: number };
    }[];
  },
  selfPlayerId: string | null,
  finish: KartPresentation | undefined,
): KartPresentation | undefined {
  const self = race.drivers.find((driver) => driver.playerId === selfPlayerId);
  const result: KartPresentation | undefined =
    race.contactVersion === 1 && !race.ended && self?.status === "RACING"
      ? {
          version: 2,
          assetVersion: "kart-assets-v1",
          events: finish?.events ?? [],
          contacts: self.lastImpact
            ? [
                {
                  eventId: self.lastImpact.eventId,
                  atMs: self.lastImpact.atMs,
                  playerId: self.playerId,
                },
              ]
            : [],
          ...(race.handling === "bounce-v1"
            ? {
                handling: {
                  preset: "bounce-v1" as const,
                  stunMs: Math.max(
                    0,
                    Math.min(
                      kartBounceTuning.stunMs,
                      Math.floor(self.physics?.stunMs ?? 0),
                    ),
                  ),
                  cooldownMs: Math.max(
                    0,
                    Math.min(
                      kartBounceTuning.cooldownMs,
                      Math.floor(self.physics?.impactCooldownMs ?? 0),
                    ),
                  ),
                },
              }
            : {}),
        }
      : finish;
  return finish?.version === 3 && result?.version === 2
    ? {
        ...finish,
        contacts: result.contacts,
        handling: result.handling,
        events: result.events,
      }
    : result;
}
export function kartItemsPresentation(
  race: {
    itemRules?: KartItemRules;
    itemsWorld?: KartProjectileWorld;
    drivers: readonly { playerId: string; power?: KartPowers }[];
  },
  selfPlayerId: string | null,
  original: KartPresentation | undefined,
): KartPresentation | undefined {
  if (race.itemRules?.version !== 2) return original;
  return {
    version: 3,
    assetVersion: "kart-assets-v1",
    events: original?.events ?? [],
    recap: original && original.version !== 2 ? original.recap : undefined,
    contacts: original && original.version !== 1 ? original.contacts : [],
    handling: original && original.version !== 1 ? original.handling : undefined,
    items: {
      version: 2,
      allowed: [...allowedKartItems(race.itemRules)],
      spawning: race.itemsWorld?.spawning ?? true,
      heldItem:
        race.drivers.find((row) => row.playerId === selfPlayerId)?.power?.item ?? null,
      projectiles:
        original?.version === 3
          ? original.items.projectiles
          : race.itemsWorld
            ? projectKartProjectiles(race.itemsWorld)
            : [],
    },
  };
}

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
