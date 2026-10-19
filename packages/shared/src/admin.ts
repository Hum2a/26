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
