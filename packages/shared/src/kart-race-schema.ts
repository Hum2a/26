/**
 * The race view every page validates in a room snapshot. It stays apart from
 * kart.ts so the join and lobby pages do not load the driving code or track geometry.
 */
import { z } from "zod";
import { kartPresentationSchema } from "./kart-events.ts";
import { parkTrackId } from "./kart-park.ts";
import { kartPowerViewSchema } from "./kart-powers.ts";
import { importedTrackId, importedTrackLimitMs } from "./kart-route.ts";
import { kartSettingsSchema } from "./kart-settings.ts";
import { kartSpectatorSchema } from "./kart-spectator.ts";

export const kartTrackId = "party-ring-v1" as const;
export const kartLimitMs = 45_000;
export type KartTrackId =
  typeof kartTrackId | typeof importedTrackId | typeof parkTrackId;
/** Optional host presentation choice; absence preserves the legacy renderer. */
export const kartLookNameSchema = z.enum([
  "off",
  "daylight",
  "warm",
  "crisp",
  "cool",
  "race",
]);
export type KartLookName = z.infer<typeof kartLookNameSchema>;
export const kartLookHistorySchema = z
  .array(
    z
      .object({
        atMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        preset: kartLookNameSchema,
      })
      .strict(),
  )
  .max(20);
export type KartLookHistory = z.infer<typeof kartLookHistorySchema>;
export const kartDriverSchema = z
  .object({
    playerId: z.string(),
    name: z.string().min(1).max(24),
    number: z.number().int().positive(),
    gridPosition: z.number().int().min(1).max(100).optional(),
    x: z.number().finite(),
    z: z.number().finite(),
    heading: z.number().finite(),
    speed: z.number().finite(),
    turnRate: z.number().finite().min(-10).max(10).optional(),
    contact: z.boolean().optional(),
    progress: z.number().min(0).max(1),
    checkpoint: z.number().int().min(0).max(8),
    // Defaults accept older stored/public snapshots during a rolling update.
    driftCharge: z.number().min(0).max(1).default(0),
    driftChargeMs: z.number().min(0).max(2400).optional(),
    boostRemainingMs: z.number().int().min(0).max(1200).default(0),
    drifting: z.boolean().default(false),
    driftLevel: z.number().int().min(0).max(3).optional(),
    boostLevel: z.number().int().min(0).max(3).optional(),
    height: z.number().min(0).max(20).optional(),
    wrongWay: z.boolean().default(false),
    status: z.enum(["RACING", "FINISHED", "DNF"]),
    lapTimeMs: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type KartDriver = z.infer<typeof kartDriverSchema>;
export const kartRaceSchema = z
  .object({
    raceId: z.string(),
    trackId: z.enum([kartTrackId, importedTrackId, parkTrackId]),
    timeLimitMs: z.union([z.literal(kartLimitMs), z.literal(importedTrackLimitMs)]),
    elapsedMs: z.number().int().min(0).max(importedTrackLimitMs),
    ended: z.boolean(),
    selfPlayerId: z.string().nullable(),
    inputCursor: z.number().int().nonnegative().nullable(),
    // Frozen race size; phone leaderboards intentionally contain only a shortlist.
    participantCount: z.number().int().min(0).max(100).optional(),
    powers: kartPowerViewSchema.optional(),
    courseEnabled: z.boolean().optional(),
    opponentsEnabled: z.boolean().optional(),
    effectsEnabled: z.boolean().optional(),
    look: kartLookNameSchema.optional().catch(undefined),
    // Host driving-feel choices; absent means the defaults in kart-settings.ts.
    settings: kartSettingsSchema.optional(),
    spectator: kartSpectatorSchema.optional().catch(undefined),
    // Unsupported cosmetic metadata must not invalidate authoritative driving state.
    presentation: kartPresentationSchema.optional().catch(undefined),
    participants: z.array(kartDriverSchema).max(100),
    nearby: z
      .array(kartDriverSchema)
      .max(8)
      .refine(
        (drivers) => new Set(drivers.map((d) => d.playerId)).size === drivers.length,
      )
      .optional()
      .catch(undefined),
    leaderboard: z
      .array(
        z
          .object({
            playerId: z.string(),
            name: z.string(),
            timeMs: z.number().int().nullable(),
            finished: z.boolean(),
            place: z.number().int().positive(),
            points: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type KartRaceView = z.infer<typeof kartRaceSchema>;
export const kartTickMs = 200;
export const kartNeutral = { steer: 0, gas: false, brake: false, drift: false };
export const kartControlsSchema = z
  .object({
    steer: z.number().finite().min(-1).max(1),
    gas: z.boolean(),
    brake: z.boolean(),
    drift: z.boolean(),
  })
  .strict();
export type KartControls = z.infer<typeof kartControlsSchema>;
export const kartInputSchema = kartControlsSchema
  .extend({
    raceId: z.string().min(1).max(120),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type KartInput = z.infer<typeof kartInputSchema>;
/** A race tick sent instead of a full snapshot. The client merges it into its last snapshot. */
export const kartFrameSchema = z.object({
  kind: z.literal("kart"),
  scope: z.literal("public"),
  stateVersion: z.number().int().nonnegative(),
  serverNow: z.number().int(),
  submissionCount: z.number().int().nonnegative(),
  kart: kartRaceSchema,
});
export type KartFrame = z.infer<typeof kartFrameSchema>;
