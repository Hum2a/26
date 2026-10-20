import type { ChoiceQuestion } from "./definition.ts";
import type { GameStore } from "../room/lifecycle.ts";
import { gateMessage, collectDeadline } from "./slider.ts";
import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerLateMessage,
} from "../room/limits.ts";

export function checkedChoices(
  question: ChoiceQuestion,
  body: unknown,
): string[] | null {
  if (
    question.outcome.kind !== "multiple" ||
    typeof body !== "string" ||
    body.length > 200
  )
    return null;
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > question.options.length ||
    new Set(value).size !== value.length ||
    value.some(
      (id) =>
        typeof id !== "string" || !question.options.some((option) => option.id === id),
    )
  )
    return null;
  return [...value].sort() as string[];
}

/** Uses the existing choice ledger and the existing idempotent text intent for a set selection. */
export function acceptMultiple(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  body: unknown,
  now: number,
  question: ChoiceQuestion,
) {
  const message = gateMessage(store, now);
  if (message) return { ok: false as const, message };
  const room = store.readRoom();
  if (room.phase !== "collect")
    return { ok: false as const, message: answerClosedMessage };
  const selected = checkedChoices(question, body);
  if (!selected)
    return {
      ok: false as const,
      message: "Select one or more different options from this question.",
    };
  if (
    sql
      .exec(
        "SELECT option_id FROM choice_answer WHERE player_id = ? AND question_id = ?",
        playerId,
        question.id,
      )
      .toArray().length
  )
    return { ok: false as const, message: answerDuplicateMessage };
  const deadline = collectDeadline(store, room.phaseGeneration);
  if (deadline === undefined) return { ok: false as const, message: answerLateMessage };
  sql.exec(
    "INSERT INTO choice_answer (player_id, question_id, phase_generation, option_id, received_at, deadline_at, device_context_id) VALUES (?, ?, ?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))",
    playerId,
    question.id,
    room.phaseGeneration,
    selected.join(","),
    now,
    deadline,
    playerId,
  );
  sql.exec("UPDATE room SET state_version = state_version + 1");
  return { ok: true as const };
}
