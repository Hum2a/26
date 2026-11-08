import { passwordKey } from "../../../../packages/shared/src/party-scoring.ts";
import { readRoundState, writeRoundState } from "./round-state.ts";

/**
 * Written answers the host has hidden from public screens, per question, as
 * author ids in the durable `round_state` store. The answer itself is never
 * deleted or rewritten; only the host's projection still shows it, marked
 * hidden, so it can be restored.
 */
const hiddenKey = "hidden-authors";

export function hiddenAuthors(sql: SqlStorage, questionId: string): Set<string> {
  const stored = readRoundState<unknown>(sql, questionId, hiddenKey);
  return new Set(
    Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === "string")
      : [],
  );
}

/**
 * Whether `authorId`'s written answer to `questionId` may be quoted on a public
 * screen: the host has not hidden it, and, on a vote, its card is on the
 * ballot (a shortlist answer the host never shortlisted was never public).
 */
export function quotableAnswer(
  sql: SqlStorage,
  questionId: string,
  authorId: string,
): boolean {
  if (hiddenAuthors(sql, questionId).has(authorId)) return false;
  return sql
    .exec<{ included: number }>(
      `SELECT included FROM vote_candidate WHERE question_id = ? AND owner_id = ?`,
      questionId,
      authorId,
    )
    .toArray()[0]?.included === 1;
}

/**
 * Hides or restores `authorId`'s answer and every other answer with the same
 * text (ignoring case and spacing), so hidden text cannot survive under a
 * duplicate. Returns the authors whose state changed group.
 */
export function setAnswerHidden(
  sql: SqlStorage,
  questionId: string,
  answers: readonly { playerId: string; body: string }[],
  authorId: string,
  hidden: boolean,
): string[] {
  const target = answers.find((answer) => answer.playerId === authorId);
  if (!target) {
    return [];
  }
  const key = passwordKey(target.body);
  const group = answers
    .filter((answer) => passwordKey(answer.body) === key)
    .map((answer) => answer.playerId);
  const current = hiddenAuthors(sql, questionId);
  for (const id of group) {
    if (hidden) current.add(id);
    else current.delete(id);
  }
  writeRoundState(sql, questionId, hiddenKey, [...current].sort());
  return group;
}
