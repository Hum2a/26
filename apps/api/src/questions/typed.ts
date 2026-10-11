import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerLateMessage,
  typedInvalidMessage,
} from "../room/limits.ts";
import type { GameStore } from "../room/lifecycle.ts";
import type { TypedQuestion } from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { collectDeadline, gateMessage } from "./slider.ts";
import { matchTyped } from "./typed-match.ts";

/** Typed answers use `round_response` with kind `typed`. The match is decided at the reveal. */
export function checkTypedAnswer(
  question: TypedQuestion,
  value: unknown,
): { ok: true; body: string } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return { ok: false, message: typedInvalidMessage };
  }
  const body = value.trim();
  if (
    body.length < 1 ||
    body.length > question.maxLength ||
    [...body].some((character) => character.charCodeAt(0) <= 31)
  ) {
    return { ok: false, message: typedInvalidMessage };
  }
  return { ok: true, body };
}

export function pointsForTyped(
  question: TypedQuestion,
  body: string | undefined,
): { points: number; detail: string } {
  if (body === undefined) {
    return { points: 0, detail: "missing" };
  }
  return matchTyped(body, question.accepted).correct
    ? { points: question.points, detail: "correct" }
    : { points: 0, detail: "miss" };
}

export function acceptTypedAnswer(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: TypedQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  const room = store.readRoom();
  if (room.phase !== "collect") {
    return { ok: false, message: answerClosedMessage };
  }
  const checked = checkTypedAnswer(question, value);
  if (!checked.ok) {
    return checked;
  }
  if (readTypedAnswer(sql, playerId, question.id) !== undefined) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const deadline = collectDeadline(store, room.phaseGeneration);
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO round_response (
       player_id, question_id, kind, payload, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, 'typed', ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    JSON.stringify({ body: checked.body }),
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function readTypedAnswer(
  sql: SqlStorage,
  playerId: string,
  questionId: string,
): string | undefined {
  const row = sql
    .exec<{ payload: string }>(
      `SELECT payload FROM round_response
       WHERE player_id = ? AND question_id = ? AND kind = 'typed'`,
      playerId,
      questionId,
    )
    .toArray()[0];
  return row ? bodyOf(row.payload) : undefined;
}

export function typedScores(
  sql: SqlStorage,
  question: TypedQuestion,
  now: number,
): void {
  const players = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray();
  for (const player of players) {
    const scored = pointsForTyped(
      question,
      readTypedAnswer(sql, player.player_id, question.id),
    );
    sql.exec(
      `INSERT OR IGNORE INTO score_ledger (
         question_id, player_id, points, detail, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      question.id,
      player.player_id,
      scored.points,
      scored.detail,
      now,
    );
  }
}

export function publicTypedQuestion(
  question: TypedQuestion,
  index: number,
  total: number,
) {
  return {
    ...publicQuestionCore(question, index, total),
    kind: "typed" as const,
    maxLength: question.maxLength,
  };
}

/** Wrong answers stay off the stage. Names appear only when attribution allows. */
export function typedReveal(
  sql: SqlStorage,
  question: TypedQuestion,
  scored: boolean,
  showNames: boolean,
) {
  if (!scored) {
    return null;
  }
  const rows = typedRows(sql, question.id);
  const correct = rows.filter((row) => matchTyped(row.body, question.accepted).correct);
  return {
    kind: "typed" as const,
    answer: question.accepted[0] ?? "",
    correctCount: correct.length,
    responseCount: rows.length,
    correctNames: showNames ? correct.map((row) => row.nickname) : null,
  };
}

export function typedHostResponses(sql: SqlStorage, question: TypedQuestion) {
  return typedRows(sql, question.id).map((row) => ({
    playerId: row.playerId,
    nickname: row.nickname,
    summary: `${matchTyped(row.body, question.accepted).correct ? "Right" : "Wrong"}: ${row.body}`,
  }));
}

function typedRows(sql: SqlStorage, questionId: string) {
  return sql
    .exec<{ player_id: string; nickname: string; payload: string }>(
      `SELECT round_response.player_id, player.nickname, round_response.payload
       FROM round_response
       JOIN player ON player.player_id = round_response.player_id
       WHERE round_response.question_id = ? AND round_response.kind = 'typed'
         AND player.revoked_at IS NULL
       ORDER BY round_response.received_at ASC`,
      questionId,
    )
    .toArray()
    .flatMap((row) => {
      const body = bodyOf(row.payload);
      return body === undefined
        ? []
        : [{ playerId: row.player_id, nickname: row.nickname, body }];
    });
}

function bodyOf(payload: string): string | undefined {
  const parsed = JSON.parse(payload) as { body?: unknown };
  return typeof parsed.body === "string" ? parsed.body : undefined;
}
