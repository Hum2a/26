import { z } from "zod";

/**
 * Answer trends: after each question, how different groups in the room
 * answered (iPhone vs Android, dark mode, the fastest quarter, the leaders…).
 * Cards are plain sentences with their numbers already in them. A device or
 * behaviour card never names a guest; only a record card (fastest, closest)
 * names its holder, as the reveal already does for winners.
 */
export const trendIcons = [
  "apple",
  "android",
  "laptop",
  "tablet",
  "compass",
  "globe",
  "moon",
  "sun",
  "ruler",
  "sparkles",
  "languages",
  "clock",
  "wifi",
  "plug",
  "cpu",
  "feather",
  "rotate",
  "leaf",
  "zap",
  "hourglass",
  "alarm",
  "crown",
  "footprints",
  "skull",
  "shield",
  "camera",
  "smile",
  "flame",
  "type",
  "users",
  "split",
  "target",
  "trophy",
  "ghost",
  "brain",
  "chart",
  "flag",
  "dice",
] as const;

export const trendIconSchema = z.enum(trendIcons);
export type TrendIcon = z.infer<typeof trendIconSchema>;

export const trendToneSchema = z.enum(["answer", "record", "device", "behaviour"]);
export type TrendTone = z.infer<typeof trendToneSchema>;

export const trendBarSchema = z
  .object({
    label: z.string().min(1).max(40),
    /** Width of the bar, 0 to 100. */
    value: z.number().min(0).max(100),
    /** Already formatted: "71%", "£8.80", "3.4s". */
    display: z.string().min(1).max(16),
    highlight: z.boolean(),
  })
  .strict();

export const trendCardSchema = z
  .object({
    id: z.string().min(1).max(120),
    facet: z.string().min(1).max(32),
    tone: trendToneSchema,
    icon: trendIconSchema,
    headline: z.string().min(1).max(120),
    detail: z.string().min(1).max(220),
    figure: z
      .object({
        value: z.string().min(1).max(16),
        caption: z.string().min(1).max(48),
      })
      .strict()
      .nullable(),
    bars: z.array(trendBarSchema).max(4),
  })
  .strict();

export type TrendCard = z.infer<typeof trendCardSchema>;

/** Stage: the cards for the question just revealed. */
export const questionTrendsSchema = z
  .object({
    questionId: z.string().min(1).max(40),
    responses: z.number().int().nonnegative(),
    cards: z.array(trendCardSchema).max(8),
  })
  .strict();

export type QuestionTrends = z.infer<typeof questionTrendsSchema>;

export const trendLineSchema = z
  .object({
    icon: trendIconSchema,
    text: z.string().min(1).max(160),
  })
  .strict();

export type TrendLine = z.infer<typeof trendLineSchema>;

/** One guest's phone: how they compared with the room. */
export const selfTrendsSchema = z
  .object({
    questionId: z.string().min(1).max(40),
    lines: z.array(trendLineSchema).min(1).max(4),
  })
  .strict();

export type SelfTrends = z.infer<typeof selfTrendsSchema>;

export const trendDisplaySchema = z.enum(["shown", "hidden"]);
export type TrendDisplay = z.infer<typeof trendDisplaySchema>;

export const trendChangeSchema = z.enum([
  "stage-shown",
  "stage-hidden",
  "phones-shown",
  "phones-hidden",
  "card-hidden",
  "card-restored",
]);
export type TrendChange = z.infer<typeof trendChangeSchema>;

export const trendCardIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9:_.-]+$/);

/** Control only: the switches, every candidate card and recent questions. */
export const trendControlSchema = z
  .object({
    stage: trendDisplaySchema,
    phones: trendDisplaySchema,
    hiddenCards: z.array(trendCardIdSchema).max(200),
    history: z
      .array(
        z
          .object({
            atMs: z.number().int().nonnegative(),
            change: trendChangeSchema,
            cardId: trendCardIdSchema.optional(),
          })
          .strict(),
      )
      .max(20),
    current: z
      .object({
        questionId: z.string().min(1).max(40),
        prompt: z.string().min(1).max(240),
        responses: z.number().int().nonnegative(),
        classified: z.number().int().nonnegative(),
        cards: z
          .array(
            trendCardSchema
              .extend({
                score: z.number().min(0).max(100),
                hidden: z.boolean(),
                onStage: z.boolean(),
              })
              .strict(),
          )
          .max(40),
      })
      .strict()
      .nullable(),
    recent: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(40),
            prompt: z.string().min(1).max(240),
            responses: z.number().int().nonnegative(),
            headlines: z.array(z.string().min(1).max(120)).max(3),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

export type TrendControl = z.infer<typeof trendControlSchema>;

/** How many cards the projector rotates through for one question. */
export const trendStageCap = 6;

/**
 * A comparison needs at least this many guests on each side. Lower than the
 * podium highlights' five because these are playful one-question asides; a
 * device or behaviour card still never names anyone.
 */
export const trendMinimumGroup = 3;
