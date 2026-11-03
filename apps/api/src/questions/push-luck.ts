import type { ChoiceQuestion, PushOutcome } from "./definition.ts";

/**
 * Push your luck. Lines appear one every `lineMs` from the start of answering.
 * A Raid hits after one of `raidAfter` lines (or never, for `null`), drawn at
 * random and stored when answering opens, before any guest can act. A guest
 * who BAILs before the Raid keeps the bank for the line showing when the room
 * received the bail. Anyone still in when the Raid hits scores nothing; if no
 * Raid comes, everyone still in keeps the final bank.
 */
export const pushBailOptionId = "bail";

const raidKey = "push-raid";

export function freezeRaid(sql: SqlStorage, question: ChoiceQuestion): void {
  if (question.outcome.kind !== "push") return;
  const choices = question.outcome.raidAfter;
  const draw = new Uint32Array(1);
  crypto.getRandomValues(draw);
  const raidAfter = choices[draw[0]! % choices.length] ?? null;
  // INSERT OR IGNORE: a repeated phase entry never re-draws the Raid.
  sql.exec(
    `INSERT OR IGNORE INTO round_state (question_id, state_key, payload) VALUES (?, ?, ?)`,
    question.id,
    raidKey,
    JSON.stringify({ raidAfter }),
  );
}

/** The frozen Raid: a line count, `null` for no Raid, or undefined before answering. */
export function readRaid(
  sql: SqlStorage,
  questionId: string,
): number | null | undefined {
  const row = sql
    .exec<{ payload: string }>(
      `SELECT payload FROM round_state WHERE question_id = ? AND state_key = ?`,
      questionId,
      raidKey,
    )
    .toArray()[0];
  if (!row) return undefined;
  const parsed = JSON.parse(row.payload) as { raidAfter: number | null };
  return parsed.raidAfter;
}

/** Index of the line showing at `receivedAt`, from the room's own clock. */
export function pushLineAt(
  outcome: PushOutcome,
  receivedAt: number,
  deadlineAt: number,
  collectMs: number,
): number {
  const elapsed = Math.max(0, receivedAt - (deadlineAt - collectMs));
  return Math.min(outcome.lines.length - 1, Math.floor(elapsed / outcome.lineMs));
}

export function pushPoints(
  outcome: PushOutcome,
  answer: { optionId: string; receivedAt: number; deadlineAt: number } | undefined,
  raidAfter: number | null,
  collectMs: number,
): { points: number; detail: string } {
  const raidAt =
    raidAfter === null ? Number.POSITIVE_INFINITY : raidAfter * outcome.lineMs;
  if (answer && answer.optionId === pushBailOptionId) {
    const elapsed = Math.max(0, answer.receivedAt - (answer.deadlineAt - collectMs));
    if (elapsed >= raidAt) return { points: 0, detail: "raided" };
    const line = pushLineAt(outcome, answer.receivedAt, answer.deadlineAt, collectMs);
    return { points: outcome.banks[line] ?? 0, detail: `banked-${line + 1}` };
  }
  if (raidAfter !== null) return { points: 0, detail: "raided" };
  return { points: outcome.banks.at(-1) ?? 0, detail: "held" };
}

/** Authoring and content-check rules for a push-your-luck outcome. */
export function assertPushOutcome(outcome: PushOutcome, collectMs: number): void {
  if (outcome.lines.length < 2 || outcome.lines.length > 8) {
    throw new Error("A push-your-luck round needs two to eight lines.");
  }
  if (outcome.banks.length !== outcome.lines.length) {
    throw new Error("Give one bank value for each push-your-luck line.");
  }
  if (
    outcome.banks.some((bank, index) => index > 0 && bank <= outcome.banks[index - 1]!)
  ) {
    throw new Error("Push-your-luck banks must rise with each line.");
  }
  if (outcome.lines.length * outcome.lineMs > collectMs) {
    throw new Error("Every push-your-luck line must appear before answering closes.");
  }
  if (
    outcome.raidAfter.length === 0 ||
    outcome.raidAfter.some(
      (after) =>
        after !== null &&
        (!Number.isInteger(after) || after < 1 || after > outcome.lines.length),
    )
  ) {
    throw new Error("Each possible Raid must follow one of the round's lines.");
  }
}
