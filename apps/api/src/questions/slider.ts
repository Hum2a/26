import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerHeldMessage,
  answerLateMessage,
  answerPausedMessage,
  estimateClosedMessage,
  estimateInvalidMessage,
  estimateStepMessage,
} from "../room/limits.ts";
import { submissionGate, type GameStore, type RoomPhase } from "../room/lifecycle.ts";
import type { AttributionMode, SliderQuestion } from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { playableQuestions, questionPacks } from "./registry.ts";

const stepTolerance = 1e-8;

export function assertSliderQuestion(question: SliderQuestion): void {
  const numbers = [
    question.minimum,
    question.maximum,
    question.step,
    question.initial,
    question.truth,
  ];
  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error("A slider needs finite bounds, step, initial value and truth.");
  }
  if (question.maximum <= question.minimum) {
    throw new Error("A slider range has to be wider than zero.");
  }
  if (question.step <= 0) {
    throw new Error("A slider step has to be greater than zero.");
  }
  if (!onStep(question, question.maximum) || !onStep(question, question.minimum)) {
    throw new Error("A slider step has to land on both ends of the range.");
  }
  if (!contains(question, question.initial) || !contains(question, question.truth)) {
    throw new Error("A slider initial value and truth have to sit on the scale.");
  }
  for (const band of question.bands) {
    if (!Number.isFinite(band.within) || band.within < 0) {
      throw new Error("A slider band needs a distance of zero or more.");
    }
    if (
      !Number.isInteger(band.points) ||
      band.points < 0 ||
      band.points > question.points
    ) {
      throw new Error("A slider band has to stay inside that question's points.");
    }
  }
}

export function checkEstimate(
  question: SliderQuestion,
  value: unknown,
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: estimateInvalidMessage };
  }
  if (value < question.minimum || value > question.maximum) {
    return { ok: false, message: estimateInvalidMessage };
  }
  if (!onStep(question, value)) {
    return { ok: false, message: estimateStepMessage };
  }
  return { ok: true, value };
}

/**
 * The narrowest matching band wins. Distance equal to `within` is included.
 * No matching band scores 0. Awards stay inside the question's own points.
 */
export function pointsForEstimate(
  question: SliderQuestion,
  value: number | undefined,
): { points: number; detail: string } {
  if (value === undefined) {
    return { points: 0, detail: "missing" };
  }
  const distance = Math.abs(value - question.truth);
  const band = question.bands
    .filter((item) => distance <= item.within + stepTolerance)
    .sort((left, right) => left.within - right.within || right.points - left.points)[0];
  if (!band) {
    return { points: 0, detail: "miss" };
  }
  return {
    points: band.points,
    detail: band.within === 0 ? "exact" : `within-${band.within}`,
  };
}

export function acceptEstimate(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: SliderQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  const room = store.readRoom();
  if (room.phase !== "collect") {
    return { ok: false, message: answerClosedMessage };
  }
  const checked = checkEstimate(question, value);
  if (!checked.ok) {
    return checked;
  }
  const existing = readEstimate(sql, playerId, question.id);
  if (existing !== undefined) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const deadline = collectDeadline(store, room.phaseGeneration);
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO round_response (
       player_id, question_id, kind, payload, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, 'slider', ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    JSON.stringify({ value: checked.value }),
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function readEstimate(
  sql: SqlStorage,
  playerId: string,
  questionId: string,
): number | undefined {
  const row = sql
    .exec<{ payload: string }>(
      `SELECT payload FROM round_response
       WHERE player_id = ? AND question_id = ? AND kind = 'slider'`,
      playerId,
      questionId,
    )
    .toArray()[0];
  if (!row) {
    return undefined;
  }
  const parsed = JSON.parse(row.payload) as { value?: unknown };
  return typeof parsed.value === "number" && Number.isFinite(parsed.value)
    ? parsed.value
    : undefined;
}

export function sliderScores(
  sql: SqlStorage,
  question: SliderQuestion,
  now: number,
): void {
  const players = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray();
  for (const player of players) {
    const scored = pointsForEstimate(
      question,
      readEstimate(sql, player.player_id, question.id),
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

export function publicSliderQuestion(
  question: SliderQuestion,
  index: number,
  total: number,
) {
  return {
    ...publicQuestionCore(question, index, total),
    kind: "slider" as const,
    minimum: question.minimum,
    maximum: question.maximum,
    step: question.step,
    unit: question.unit,
    initial: question.initial,
  };
}

export function sliderReveal(
  sql: SqlStorage,
  question: SliderQuestion,
  scored: boolean,
  showNames: boolean,
) {
  if (!scored) {
    return null;
  }
  const rows = sql
    .exec<{ nickname: string; payload: string; points: number }>(
      `SELECT player.nickname, round_response.payload,
              COALESCE(score_ledger.points, 0) AS points
       FROM round_response
       JOIN player ON player.player_id = round_response.player_id
       LEFT JOIN score_ledger
         ON score_ledger.player_id = round_response.player_id
        AND score_ledger.question_id = round_response.question_id
       WHERE round_response.question_id = ? AND round_response.kind = 'slider'
         AND player.revoked_at IS NULL
       ORDER BY player.rowid ASC`,
      question.id,
    )
    .toArray();
  return {
    kind: "slider" as const,
    truth: question.truth,
    unit: question.unit,
    guesses: rows.flatMap((row) => {
      const parsed = JSON.parse(row.payload) as { value?: unknown };
      if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value)) {
        return [];
      }
      return [
        {
          nickname: showNames ? row.nickname : null,
          value: parsed.value,
          points: row.points,
        },
      ];
    }),
  };
}

export function sliderHostResponses(sql: SqlStorage, question: SliderQuestion) {
  return sql
    .exec<{ player_id: string; nickname: string; payload: string }>(
      `SELECT round_response.player_id, player.nickname, round_response.payload
       FROM round_response
       JOIN player ON player.player_id = round_response.player_id
       WHERE round_response.question_id = ? AND round_response.kind = 'slider'
         AND player.revoked_at IS NULL
       ORDER BY round_response.received_at ASC`,
      question.id,
    )
    .toArray()
    .flatMap((row) => {
      const parsed = JSON.parse(row.payload) as { value?: unknown };
      if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value)) {
        return [];
      }
      return [
        {
          playerId: row.player_id,
          nickname: row.nickname,
          summary: `${parsed.value} ${question.unit}`,
        },
      ];
    });
}

export function responseCount(sql: SqlStorage, questionId: string): number {
  const row = sql
    .exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM round_response WHERE question_id = ?`,
      questionId,
    )
    .toArray()[0];
  return row?.total ?? 0;
}

export function responseNames(
  sql: SqlStorage,
  questionId: string,
  attribution: AttributionMode,
  phase: RoomPhase,
  limit: number,
): string[] | null {
  if (attribution !== "live" || phase !== "collect") {
    return null;
  }
  const rows = sql
    .exec<{ nickname: string }>(
      `SELECT player.nickname FROM round_response
       JOIN player ON player.player_id = round_response.player_id
       WHERE round_response.question_id = ? AND player.revoked_at IS NULL
       ORDER BY round_response.received_at DESC, player.rowid DESC
       LIMIT ?`,
      questionId,
      limit,
    )
    .toArray();
  return rows.map((row) => row.nickname).reverse();
}

function onStep(question: SliderQuestion, value: number): boolean {
  const steps = (value - question.minimum) / question.step;
  return Math.abs(steps - Math.round(steps)) < stepTolerance;
}

function contains(question: SliderQuestion, value: number): boolean {
  return (
    value >= question.minimum - stepTolerance &&
    value <= question.maximum + stepTolerance &&
    onStep(question, value)
  );
}

function collectDeadline(
  store: GameStore,
  phaseGeneration: number,
): number | undefined {
  const due = store
    .jobs()
    .find(
      (job) =>
        job.jobType === "gameplay" &&
        job.status === "pending" &&
        job.phase === "collect" &&
        job.phaseGeneration === phaseGeneration,
    )?.dueAt;
  return due === null ? undefined : due;
}

function gateMessage(store: GameStore, now: number): string | undefined {
  const gate = submissionGate(store, now);
  if (gate.ok) {
    return undefined;
  }
  if (gate.reason === "late") {
    return answerLateMessage;
  }
  if (gate.reason === "paused") {
    return answerPausedMessage;
  }
  if (gate.reason === "held") {
    return answerHeldMessage;
  }
  return answerClosedMessage;
}

export function wrongKindEstimate(): string {
  return estimateClosedMessage;
}

for (const pack of questionPacks) {
  if (pack.release !== "released") {
    continue;
  }
  for (const question of playableQuestions(pack)) {
    if (question.kind === "slider") {
      assertSliderQuestion(question);
    }
  }
}
