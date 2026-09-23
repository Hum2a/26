import { z } from "zod";

/**
 * Percentage comparisons need at least this many players or accepted responses
 * in the group. The cutoff was chosen before any party results.
 */
export const minimumComparisonGroup = 5;

export const statCardSchema = z
  .object({
    id: z.string().min(1).max(80),
    factId: z.string().min(1).max(80),
    illustrative: z.boolean(),
    display: z.enum(["eligible", "suppressed"]),
    stage: z.string().min(1).max(280),
    results: z.string().min(1).max(400),
  })
  .strict();

export type StatCard = z.infer<typeof statCardSchema>;
