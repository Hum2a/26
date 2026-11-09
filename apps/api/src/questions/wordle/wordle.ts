import {
  emptyWordleBoard,
  reduceWordle,
  wordleBoardSchema,
  type WordleBoard,
} from "@26/shared";
import type { GameStore } from "../../room/lifecycle.ts";
import type { WordleQuestion } from "../definition.ts";
import { publicQuestionCore } from "../project.ts";
import { collectDeadline, gateMessage } from "../slider.ts";
import { VALIDITY_WORDS } from "./dictionary/validity-words.ts";

const words = new Set(VALIDITY_WORDS);
export const isWordleWord = (word: string) => words.has(word);

export function readWordleBoard(
  sql: SqlStorage,
  playerId: string,
  questionId: string,
): WordleBoard {
  const row = sql
    .exec<{ payload: string }>(
      `SELECT payload FROM round_response WHERE player_id = ? AND question_id = ? AND kind = 'wordle'`,
      playerId,
      questionId,
    )
    .toArray()[0];
  return row ? wordleBoardSchema.parse(JSON.parse(row.payload)) : emptyWordleBoard();
}

/** Called inside the existing command receipt transaction; no separate live store. */
export function acceptWordleGuess(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: WordleQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = gateMessage(store, now);
  if (gate) return { ok: false, message: gate };
  const room = store.readRoom();
  if (room.phase !== "collect")
    return { ok: false, message: "Guesses are closed. Watch the stage." };
  const deadline = collectDeadline(store, room.phaseGeneration);
  if (deadline === undefined)
    return { ok: false, message: "Time is up. Watch the stage." };
  const result = reduceWordle(
    readWordleBoard(sql, playerId, question.id),
    value,
    { answer: question.answer, isWord: isWordleWord, deadline },
    now,
  );
  if (!result.ok) return result;
  sql.exec(
    `INSERT INTO round_response
    (player_id, question_id, kind, payload, received_at, deadline_at, device_context_id)
    VALUES (?, ?, 'wordle', ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))
    ON CONFLICT(player_id, question_id) DO UPDATE SET payload = excluded.payload,
      received_at = excluded.received_at, deadline_at = excluded.deadline_at,
      device_context_id = excluded.device_context_id`,
    playerId,
    question.id,
    JSON.stringify(result.state),
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function wordleScores(sql: SqlStorage, question: WordleQuestion, now: number) {
  for (const player of sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray()) {
    const board = readWordleBoard(sql, player.player_id, question.id);
    const won = board.status === "won";
    sql.exec(
      `INSERT OR IGNORE INTO score_ledger (question_id, player_id, points, detail, created_at)
      VALUES (?, ?, ?, ?, ?)`,
      question.id,
      player.player_id,
      won ? question.points : 0,
      won ? "solved" : "unsolved",
      now,
    );
  }
}

export function publicWordleQuestion(
  question: WordleQuestion,
  index: number,
  total: number,
) {
  return {
    ...publicQuestionCore(question, index, total),
    kind: "wordle" as const,
    wordLength: question.wordLength,
    maxGuesses: question.maxGuesses,
  };
}

export function wordleProgress(sql: SqlStorage, questionId: string) {
  const rows = sql
    .exec<{ payload: string }>(
      `SELECT round_response.payload FROM round_response
    JOIN player ON player.player_id = round_response.player_id
    WHERE question_id = ? AND kind = 'wordle' AND player.revoked_at IS NULL`,
      questionId,
    )
    .toArray();
  const boards = rows.map((row) => wordleBoardSchema.parse(JSON.parse(row.payload)));
  return {
    solvedCount: boards.filter((board) => board.status === "won").length,
    responseCount: boards.length,
    finishedCount: boards.filter((board) => board.status !== "playing").length,
  };
}

export function wordleReveal(
  sql: SqlStorage,
  question: WordleQuestion,
  scored: boolean,
) {
  if (!scored) return null;
  const { solvedCount, responseCount } = wordleProgress(sql, question.id);
  return {
    kind: "wordle" as const,
    answer: question.answer,
    solvedCount,
    responseCount,
  };
}
