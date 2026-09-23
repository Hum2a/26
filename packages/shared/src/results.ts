import { z } from "zod";
import { statCardSchema } from "./stats.ts";

/**
 * Named standings and shared media stay with the archive.
 * Detailed device rows still expire on the telemetry clock.
 * These periods are the selected defaults, and a later host decision can shorten them.
 */
export const publicResultRetention =
  "Named standings, shared photos, and comparison cards stay with this game. Detailed device records are removed 30 days after the room was created. A verification link lasts 1 hour. A personal results link lasts 14 days.";

export const emailVerifyTtlMs = 60 * 60 * 1000;
export const recapLinkTtlMs = 14 * 24 * 60 * 60 * 1000;

/** Short enough that a hide is picked up. A copy already downloaded cannot be recalled. */
export const galleryCacheSeconds = 60;

export function galleryAttribution(nickname: string): string {
  return `Shared by ${nickname}, who sent this photo.`;
}

export const publicStandingSchema = z
  .object({
    nickname: z.string().min(1).max(24),
    position: z.number().int().positive(),
    points: z.number().int(),
  })
  .strict();

export const publicResultsSchema = z
  .object({
    state: z.enum(["unknown", "preparing", "ready"]),
    standings: z.array(publicStandingSchema).max(80).optional(),
    highlights: z.array(statCardSchema).max(8).optional(),
    gallery: z
      .array(
        z
          .object({
            mediaId: z.uuid(),
            kind: z.enum(["photo", "voice"]),
            nickname: z.string().min(1).max(24),
            attribution: z.string().min(1).max(200),
          })
          .strict(),
      )
      .max(40)
      .optional(),
    galleryNote: z.string().max(400).optional(),
    retentionNote: z.string().max(500).optional(),
  })
  .strict();

export type PublicResults = z.infer<typeof publicResultsSchema>;

export const personalResultsSchema = z
  .object({
    nickname: z.string().min(1).max(24),
    position: z.number().int().positive(),
    points: z.number().int(),
    best: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(80),
            points: z.number().int(),
            detail: z.string().max(200),
          })
          .strict(),
      )
      .max(3),
    given: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
    recap: z.array(statCardSchema).max(6),
  })
  .strict();

export type PersonalResults = z.infer<typeof personalResultsSchema>;

export const resultsEmailSchema = z
  .object({
    status: z.enum(["sent", "uncertain", "failed", "expired", "invalid"]),
  })
  .strict();

export type ResultsEmailStatus = z.infer<typeof resultsEmailSchema>;
