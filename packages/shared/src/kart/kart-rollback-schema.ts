import { z } from "zod";
const scalar = z.number().finite();
const duration = z.number().int().min(0).max(540000);
export const kartFinishSchema = z
  .object({
    raceId: z.string().min(1).max(120),
    elapsedMs: duration.positive(),
    lapsMs: z.array(duration.positive()).min(1).max(3),
  })
  .strict()
  .refine(
    (r) =>
      r.lapsMs.at(-1) === r.elapsedMs &&
      r.lapsMs.every((t, i) => i === 0 || t > r.lapsMs[i - 1]!),
    "Lap splits must increase and end at the finish time.",
  );
export type KartFinish = z.infer<typeof kartFinishSchema>;
/** This guest's exact accepted body; never another racer's private state. */
export const kartRollbackSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    appliedSequence: z.number().int().min(-1),
    recovery: z.number().int().nonnegative(),
    body: z
      .object({
        x: scalar,
        z: scalar,
        heading: scalar,
        vx: scalar,
        vz: scalar,
        turn: scalar,
        driftMs: scalar.nonnegative(),
        boostMs: scalar.nonnegative(),
        wasDrifting: z.boolean(),
        contact: z.boolean(),
        offRoad: z.boolean(),
        boostLevel: scalar.optional(),
        height: scalar.optional(),
        verticalSpeed: scalar.optional(),
        courseMs: scalar.optional(),
        featureCooldowns: z
          .record(z.string().max(80), scalar)
          .refine((v) => Object.keys(v).length <= 64)
          .optional(),
        trackNotice: z.enum(["boost", "ramp", "hazard", "landed"]).optional(),
        driftSide: scalar.optional(),
        stunMs: scalar.optional(),
        impactCooldownMs: scalar.optional(),
      })
      .strict(),
    lap: z
      .object({
        angle: scalar,
        distance: scalar,
        checkpoint: z.number().int().min(0).max(8),
        done: z.number().int().min(0).max(3),
        splits: z.array(duration).max(3),
      })
      .strict(),
    input: z
      .object({
        steer: scalar.min(-1).max(1),
        gas: z.boolean(),
        brake: z.boolean(),
        drift: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type KartRollback = z.infer<typeof kartRollbackSchema>;
