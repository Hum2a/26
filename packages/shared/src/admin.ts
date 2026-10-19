import { z } from "zod";

export const adminContentSchema = z
  .object({
    packs: z.array(
      z
        .object({
          id: z.string(),
          version: z.string(),
          release: z.enum(["draft", "released"]),
          illustrative: z.boolean(),
          questions: z.array(
            z
              .object({
                id: z.string(),
                title: z.string(),
                prompt: z.string(),
                mechanic: z.string(),
                presentation: z.string(),
                status: z.enum(["draft", "ready"]),
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
          })
          .strict(),
      )
      .max(50),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type AdminMedia = z.infer<typeof adminMediaSchema>;
