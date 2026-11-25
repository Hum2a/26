import { z } from "zod";
import { trendCardSchema } from "./trends/trend-schema.ts";

const id = z.string().min(1).max(160);
const time = z.number().int().safe().nonnegative();
const points = z.number().int().safe();

export const analyticsQuestionIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const analyticsFactSchema = z
  .object({
    id,
    scope: z.enum(["game", "question", "player"]),
    scopeId: id,
    sourceRevision: time,
    metric: z.string().max(80),
    grouping: z.string().max(1_000),
    numerator: z.number(),
    denominator: z.number(),
    unknownCount: time,
    display: z.enum(["eligible", "suppressed", "withheld"]),
    labels: z.array(z.string().max(500)),
    parts: z.array(
      z.object({ label: z.string().max(500), count: z.number() }).strict(),
    ),
  })
  .strict();

export const archivedAnalyticsSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("ready"),
      revision: time,
      facts: z.array(analyticsFactSchema),
    })
    .strict(),
  z.object({ state: z.literal("unavailable") }).strict(),
]);

export const analyticsAnswerSchema = z
  .object({
    questionId: id,
    playerId: id,
    kind: z.enum([
      "choice",
      "typed",
      "slider",
      "rank",
      "wordle",
      "map-guess",
      "entry",
      "ballot",
      "duel",
      "prediction",
      "kart",
      "chess",
    ]),
    label: z.string().max(20_000),
    // Mechanic-specific accepted data such as ranked items, lap splits or Wordle marks.
    data: z.json(),
    receivedAt: time.nullable(),
    deadlineAt: time.nullable(),
    deviceContextId: id.nullable(),
    hidden: z.boolean(),
  })
  .strict();

export const roomAnalyticsSchema = z
  .object({
    gameId: id,
    questionSetVersion: id,
    scoringVersion: id,
    revision: time,
    createdAt: z.string().max(40),
    questionScriptAvailable: z.boolean(),
    players: z.array(
      z
        .object({
          id,
          nickname: z.string().min(1).max(80),
          joinedAt: z.string().max(40).nullable(),
          removedAt: z.string().max(40).nullable(),
          connection: z
            .object({
              opens: time,
              reconnects: time,
              samples: time,
              medianMs: time.nullable(),
              upperMs: time.nullable(),
              submissionRetries: time,
              uploadAttempts: time,
              uploadFailures: time,
              uploadDurationMs: time,
              uploadDurationCount: time,
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
    questions: z.array(
      z
        .object({
          id,
          title: z.string().max(500),
          prompt: z.string().max(4_000).nullable(),
          position: z.number().int().positive().nullable(),
          kind: z.string().max(32).nullable(),
          state: z.enum(["current", "recorded", "no-records"]),
          choices: z.array(z.object({ id, label: z.string().max(1_000) }).strict()),
        })
        .strict(),
    ),
    answers: z.array(analyticsAnswerSchema),
    scores: z.array(
      z
        .object({
          questionId: id,
          playerId: id,
          points,
          detail: z.string().max(2_000),
          at: time,
        })
        .strict(),
    ),
    adjustments: z.array(
      z
        .object({
          id,
          playerId: id,
          points,
          reason: z.string().max(2_000),
          at: time,
        })
        .strict(),
    ),
    facts: z.array(analyticsFactSchema),
  })
  .strict();

export const analyticsTrendsSchema = z
  .object({
    questionId: id,
    source: z.enum(["reconstructed", "unavailable"]),
    responses: time,
    classified: time,
    cards: z
      .array(
        trendCardSchema
          .extend({
            score: z.number().min(0).max(100),
            hidden: z.boolean(),
            selected: z.boolean(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export type AnalyticsAnswer = z.infer<typeof analyticsAnswerSchema>;
export type RoomAnalytics = z.infer<typeof roomAnalyticsSchema>;
