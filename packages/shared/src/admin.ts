import { z } from "zod";

export const birthdayOrderSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    ids: z
      .array(z.string().regex(/^[a-z0-9-]{1,40}$/))
      .min(1)
      .max(80),
    updatedAt: z.number().int().nonnegative().nullable(),
    history: z
      .array(
        z
          .object({
            revision: z.number().int().positive(),
            at: z.number().int().nonnegative(),
            count: z.number().int().min(1).max(80),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type BirthdayOrder = z.infer<typeof birthdayOrderSchema>;
export const saveBirthdayOrderSchema = z
  .object({
    requestId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    ids: birthdayOrderSchema.shape.ids,
  })
  .strict();

export const adminContentSchema = z
  .object({
    packs: z.array(
      z
        .object({
          id: z.string(),
          version: z.string(),
          release: z.enum(["draft", "released"]),
          illustrative: z.boolean(),
          runningOrder: birthdayOrderSchema.optional(),
          questions: z.array(
            z
              .object({
                id: z.string(),
                title: z.string(),
                prompt: z.string(),
                mechanic: z.string(),
                presentation: z.string(),
                status: z.enum(["draft", "ready"]),
                /** Estimated on-screen seconds for planning; pauses not included. */
                estimatedSeconds: z.number().int().nonnegative().max(3600).optional(),
                order: z.number().int().positive().nullable(),
                missing: z.array(
                  z
                    .object({ code: z.string(), name: z.string(), detail: z.string() })
                    .strict(),
                ),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type AdminContent = z.infer<typeof adminContentSchema>;

export const adminTrollsSchema = z
  .object({
    trolls: z.array(
      z
        .object({
          kind: z.string().min(1),
          label: z.string().min(1),
          assetLabel: z.string().min(1),
          slot: z.enum(["transient", "persistent"]),
          durationMs: z.number().int().nullable(),
          phases: z.array(z.string()),
          escape: z.string().nullable(),
          disruptsSubmission: z.boolean(),
          announce: z.enum(["now", "reveal", "scores"]),
          /** Only offered on these question kinds. Empty means any question. */
          questionKinds: z.array(z.string()),
          /** A score troll: only runs on a question that lists it in `modifiers`. */
          modifier: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export type AdminTrolls = z.infer<typeof adminTrollsSchema>;

/** Fetched only from the authenticated, uncached question-inspection route. */
export const adminQuestionDetailSchema = z
  .object({
    version: z.string(),
    release: z.enum(["draft", "released"]),
    question: adminContentSchema.shape.packs.element.shape.questions.element
      .extend({
        instructions: z.string().nullable(),
        notes: z.string().nullable(),
        explanation: z.string().nullable(),
        options: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
        settings: z.array(z.object({ label: z.string(), value: z.string() }).strict()),
        answer: z
          .object({
            status: z.enum(["recorded", "missing", "not-applicable"]),
            lines: z.array(z.string()),
          })
          .strict(),
        media: z.array(
          z
            .object({
              name: z.string(),
              kind: z.enum(["image", "audio"]),
              required: z.boolean(),
              supplied: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();
export type AdminQuestionDetail = z.infer<typeof adminQuestionDetailSchema>;

export const adminMediaSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            mediaId: z.uuid(),
            kind: z.enum(["photo", "voice"]),
            nickname: z.string(),
            hidden: z.boolean(),
            purpose: z.literal("face").optional(),
            photoFamily: z.enum(["iphone", "android", "unknown"]).optional(),
          })
          .strict(),
      )
      .max(50),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type AdminMedia = z.infer<typeof adminMediaSchema>;
