import { z } from "zod";

export const roomPlayerLimit = 100;
export const botCountSchema = z.number().int().min(0).max(roomPlayerLimit);
export const rehearsalConfigSchema = z
  .object({
    pack: z.enum(["demo", "birthday"]),
    botCount: botCountSchema,
    autoAnswers: z.boolean(),
    delayMs: z.number().int().min(0).max(8000),
    participation: z.number().int().min(0).max(100),
    kart: z.boolean(),
    beatMs: z.number().int().min(250).max(15000),
    collectMs: z.number().int().min(3000).max(120000),
    pauseAtReveal: z.boolean(),
    stopOnFailure: z.boolean(),
  })
  .strict();
export type RehearsalConfig = z.infer<typeof rehearsalConfigSchema>;
export const defaultRehearsalConfig: RehearsalConfig = {
  pack: "demo",
  botCount: 10,
  autoAnswers: true,
  delayMs: 1000,
  participation: 100,
  kart: false,
  beatMs: 1000,
  collectMs: 8000,
  pauseAtReveal: false,
  stopOnFailure: true,
};
export const rehearsalScenarioSchema = z.enum([
  "disconnect",
  "late-join",
  "deadline-burst",
  "host-loss",
]);
export type RehearsalScenario = z.infer<typeof rehearsalScenarioSchema>;
export const rehearsalStateSchema = z
  .object({
    config: rehearsalConfigSchema,
    revision: z.number().int().nonnegative(),
    runner: z.enum(["stopped", "running", "paused", "finished"]),
    reason: z.string().max(180),
    startedAt: z.number().int().nonnegative().nullable(),
    scenario: z
      .object({
        name: rehearsalScenarioSchema,
        at: z.number().int().nonnegative(),
        leadMs: z.number().int().min(0).max(5000),
      })
      .strict()
      .nullable(),
    questions: z
      .array(z.object({ id: z.string().max(40), title: z.string().max(240) }).strict())
      .max(80),
    events: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            at: z.number().int().nonnegative(),
            kind: z.enum([
              "host",
              "phase",
              "connection",
              "answer",
              "scenario",
              "check",
            ]),
            actor: z.string().max(24),
            detail: z.string().max(180),
            status: z.enum(["accepted", "refused", "info"]),
            phase: z.string().max(16),
            questionId: z.string().max(40).nullable(),
          })
          .strict(),
      )
      .max(200),
    checks: z
      .array(
        z
          .object({
            id: z.enum(["scores", "phase", "answers", "connections", "refusals"]),
            status: z.enum(["pass", "fail", "waiting"]),
            detail: z.string().max(180),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export type RehearsalState = z.infer<typeof rehearsalStateSchema>;
export const developerToolsSchema = z
  .object({
    rehearsal: rehearsalStateSchema.optional(),
    revision: z.number().int().nonnegative(),
    bots: z
      .array(
        z.object({ playerId: z.uuid(), nickname: z.string().min(1).max(24) }).strict(),
      )
      .max(roomPlayerLimit),
    history: z
      .array(
        z
          .object({ atMs: z.number().int().nonnegative(), count: botCountSchema })
          .strict(),
      )
      .max(20),
  })
  .strict();

/** Private transport bootstrap. Never included in a room snapshot or browser storage. */
export const botSessionsSchema = z
  .object({
    sessions: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            secret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          })
          .strict(),
      )
      .max(roomPlayerLimit),
  })
  .strict();
export type BotSession = z.infer<typeof botSessionsSchema>["sessions"][number];
