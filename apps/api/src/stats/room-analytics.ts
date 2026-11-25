import {
  analyseTrends,
  pickStageCards,
  publicTrendCard,
  type RoomAnalytics,
} from "@26/shared";
import { resolveContent } from "../questions/registry.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { aggregateFacts } from "./aggregate.ts";
import { readAnalyticsAnswers } from "./analytics-answers.ts";
import { readStatsSource } from "./source.ts";
import { readTrendSettings } from "./trend-settings.ts";
import { readTrendInput } from "./trend-source.ts";

const roundPhases = new Set([
  "intro",
  "prompt",
  "predict",
  "collect",
  "vote",
  "reveal",
  "scores",
]);

/** This is an on-demand admin read. It never adds data to room broadcasts. */
export function readRoomAnalytics(sql: SqlStorage): RoomAnalytics {
  const clock = createSqlStore(sql).readRoom();
  const room = sql
    .exec<{
      game_id: string;
      state_version: number;
      scoring_version: string;
      created_at: string;
    }>(`SELECT game_id, state_version, scoring_version, created_at FROM room`)
    .one();
  const resolved = resolveContent(clock.questionSetVersion, clock.questionScript);
  const pack = resolved.status === "playable" ? resolved.pack.questions : [];
  const byId = new Map(pack.map((question) => [question.id, question]));
  const connections = new Map(
    sql
      .exec<{
        player_id: string;
        opens: number;
        reconnects: number;
        samples: number;
        medianMs: number | null;
        upperMs: number | null;
        submissionRetries: number;
        uploadAttempts: number;
        uploadFailures: number;
        uploadDurationMs: number;
        uploadDurationCount: number;
      }>(
        `SELECT player_id, socket_opens AS opens, reconnects, rtt_count AS samples,
            rtt_median_ms AS medianMs, rtt_upper_ms AS upperMs, submission_retries AS submissionRetries,
            upload_attempts AS uploadAttempts, upload_failures AS uploadFailures,
            upload_duration_ms AS uploadDurationMs, upload_duration_count AS uploadDurationCount
       FROM connection_summary`,
      )
      .toArray()
      .map(({ player_id, ...connection }) => [player_id, connection]),
  );
  const players = sql
    .exec<{
      player_id: string;
      nickname: string;
      joined_at: string | null;
      revoked_at: string | null;
    }>(
      `SELECT player_id, nickname, joined_at, revoked_at FROM player
      WHERE client_class = 'guest' OR client_class IS NULL ORDER BY rowid`,
    )
    .toArray()
    .map((row) => ({
      id: row.player_id,
      nickname: row.nickname,
      joinedAt: row.joined_at,
      removedAt: row.revoked_at,
      connection: connections.get(row.player_id) ?? null,
    }));
  const guests = new Map(players.map((player) => [player.id, player.nickname]));
  const answers = readAnalyticsAnswers(sql, byId, guests, clock.questionSetVersion);
  const scores = sql
    .exec<{
      questionId: string;
      playerId: string;
      points: number;
      detail: string;
      at: number;
    }>(
      `SELECT question_id AS questionId, player_id AS playerId, points, detail, created_at AS at
       FROM score_ledger ORDER BY question_id, player_id`,
    )
    .toArray()
    .filter((row) => guests.has(row.playerId));
  const adjustments = sql
    .exec<RoomAnalytics["adjustments"][number]>(
      `SELECT adjustment_id AS id, player_id AS playerId, points, reason, created_at AS at
     FROM score_adjustment ORDER BY created_at, adjustment_id`,
    )
    .toArray()
    .filter((row) => guests.has(row.playerId));
  const recorded = new Set([...answers, ...scores].map((item) => item.questionId));
  const questions: RoomAnalytics["questions"] = pack.map((question, index) => ({
    id: question.id,
    title: question.title,
    prompt: question.prompt,
    position: index + 1,
    kind: question.kind,
    state:
      index === clock.questionIndex && roundPhases.has(clock.phase)
        ? "current"
        : recorded.has(question.id)
          ? "recorded"
          : "no-records",
    choices:
      question.kind === "choice"
        ? question.options.map(({ id, label }) => ({ id, label }))
        : [],
  }));
  for (const id of recorded) {
    if (byId.has(id)) continue;
    questions.push({
      id,
      title: id,
      prompt: null,
      position: null,
      kind: null,
      state: "recorded",
      choices: [],
    });
  }
  return {
    gameId: room.game_id,
    questionSetVersion: clock.questionSetVersion,
    scoringVersion: room.scoring_version,
    revision: room.state_version,
    createdAt: room.created_at,
    questionScriptAvailable: resolved.status === "playable",
    players,
    questions,
    answers,
    scores,
    adjustments,
    facts: aggregateFacts(readStatsSource(sql)).filter(
      (fact) => fact.scope !== "player" || guests.has(fact.scopeId),
    ),
  };
}

export function readAnalyticsTrends(sql: SqlStorage, questionId: string) {
  const clock = createSqlStore(sql).readRoom();
  const resolved = resolveContent(clock.questionSetVersion, clock.questionScript);
  const unavailable = {
    questionId,
    source: "unavailable" as const,
    responses: 0,
    classified: 0,
    cards: [],
  };
  if (resolved.status !== "playable") return unavailable;
  const questions = resolved.pack.questions;
  const index = questions.findIndex((question) => question.id === questionId);
  if (
    index < 0 ||
    index > clock.questionIndex ||
    (index === clock.questionIndex &&
      ["lobby", "intro", "prompt", "predict", "collect", "vote"].includes(clock.phase))
  )
    return unavailable;
  const input = readTrendInput(sql, questions, index);
  if (!input) return unavailable;
  const analysis = analyseTrends(input);
  const settings = readTrendSettings(sql);
  const hidden = new Set(settings.hiddenCards);
  const selected = new Set(pickStageCards(analysis, hidden).map((card) => card.id));
  return {
    questionId,
    source: "reconstructed" as const,
    responses: analysis.responses,
    classified: analysis.classified,
    cards: analysis.cards.map((card) => ({
      ...publicTrendCard(card),
      score: card.score,
      hidden: hidden.has(card.id),
      selected: selected.has(card.id),
    })),
  };
}
