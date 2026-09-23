import { z } from "zod";

/** Public results route. It does not include standings, recaps, or device rows. */
export const resultsStatusSchema = z
  .object({
    state: z.enum(["unknown", "preparing", "ready"]),
  })
  .strict();

export type ResultsStatus = z.infer<typeof resultsStatusSchema>;
