import {
  analyseTrends,
  pickStageCards,
  publicTrendCard,
  selfTrendLines,
  type QuestionTrends,
  type RankedTrendCard,
  type SelfTrends,
  type TrendAnalysis,
  type TrendControl,
} from "@26/shared";
import type { Question } from "../questions/definition.ts";
import { hiddenAuthors } from "../questions/hidden-answers.ts";
import { resolveContent } from "../questions/registry.ts";
import type { RoomClock } from "../room/lifecycle.ts";
import { readTrendInput } from "./trend-source.ts";
import { readTrendSettings, type TrendSettings } from "./trend-settings.ts";

/** Trends show from the reveal of a question until the next one starts. */
const trendPhases = new Set(["reveal", "scores"]);
/** Phases after which every question so far has been revealed. */
const doneQuestionPhases = new Set(["reveal", "scores", "final", "facts", "podium"]);

type StoredRoom = Pick<
  RoomClock,
  "phase" | "questionIndex" | "questionSetVersion" | "questionScript"
>;

export type RoomTrends = {
  settings: TrendSettings;
  analysis: TrendAnalysis | null;
  stage: RankedTrendCard[];
  prompt: string | null;
};

/**
 * Memory cache for one room's answer trends. Analysis runs once per question
 * when its reveal opens and again only when something it reads changes (see
 * `cacheKey`), so a broadcast to eighty phones reuses it. Earlier questions
 * are analysed once for the host. After a restart the cache rebuilds from
 * SQL; it is never the authority for anything.
 */
export class TrendCache {
  private current: {
    key: string;
    analysis: TrendAnalysis | null;
    prompt: string;
  } | null = null;
  private lines = new Map<string, SelfTrends | null>();
  /** Earlier questions' analyses, so their headlines follow the current hidden cards. */
  private past = new Map<string, { prompt: string; analysis: TrendAnalysis | null }>();

  read(sql: SqlStorage, stored: StoredRoom): RoomTrends {
    const settings = readTrendSettings(sql);
    const questions = playableQuestions(stored);
    const question = questions[stored.questionIndex];
    if (!trendPhases.has(stored.phase) || !question) {
      return { settings, analysis: null, stage: [], prompt: null };
    }
    const key = cacheKey(sql, stored.questionSetVersion, question.id);
    if (this.current?.key !== key) {
      const input = readTrendInput(sql, questions, stored.questionIndex);
      const analysis = input ? analyseTrends(input) : null;
      this.current = { key, analysis, prompt: question.prompt };
      this.lines.clear();
    }
    const analysis = this.current.analysis;
    const stage = analysis
      ? pickStageCards(analysis, new Set(settings.hiddenCards))
      : [];
    this.past.set(question.id, { prompt: question.prompt, analysis });
    return { settings, analysis, stage, prompt: question.prompt };
  }

  /** The projector's trends, or nothing when hidden or empty. */
  stage(trends: RoomTrends, stageHidden: boolean): QuestionTrends | undefined {
    if (
      stageHidden ||
      trends.settings.stage === "hidden" ||
      !trends.analysis ||
      trends.stage.length === 0
    ) {
      return undefined;
    }
    return {
      questionId: trends.analysis.questionId,
      responses: trends.analysis.responses,
      cards: trends.stage.map(publicTrendCard),
    };
  }

  /** One guest's lines. Cached per guest until the analysis changes. */
  self(trends: RoomTrends, playerId: string | undefined): SelfTrends | undefined {
    if (!playerId || trends.settings.phones === "hidden" || !trends.analysis) {
      return undefined;
    }
    const cacheId = `${playerId}:${trends.stage.map((card) => card.id).join("|")}`;
    if (!this.lines.has(cacheId)) {
      const lines = selfTrendLines(trends.analysis, playerId, trends.stage);
      this.lines.set(
        cacheId,
        lines ? { questionId: trends.analysis.questionId, lines } : null,
      );
    }
    return this.lines.get(cacheId) ?? undefined;
  }

  /** The host's view: switches, every candidate card and recent questions. */
  control(sql: SqlStorage, stored: StoredRoom, trends: RoomTrends): TrendControl {
    const hidden = new Set(trends.settings.hiddenCards);
    const onStage = new Set(trends.stage.map((card) => card.id));
    const analysis = trends.analysis;
    return {
      stage: trends.settings.stage,
      phones: trends.settings.phones,
      hiddenCards: trends.settings.hiddenCards,
      history: trends.settings.history,
      current:
        analysis && trends.prompt
          ? {
              questionId: analysis.questionId,
              prompt: clip(trends.prompt, 240),
              responses: analysis.responses,
              classified: analysis.classified,
              cards: analysis.cards.map((card) => ({
                ...publicTrendCard(card),
                score: card.score,
                hidden: hidden.has(card.id),
                onStage: onStage.has(card.id),
              })),
            }
          : null,
      recent: this.recent(sql, stored, hidden),
    };
  }

  /** Up to twelve earlier questions, newest first, summarised once each. */
  private recent(
    sql: SqlStorage,
    stored: StoredRoom,
    hidden: ReadonlySet<string>,
  ): TrendControl["recent"] {
    const questions = playableQuestions(stored);
    const last = doneQuestionPhases.has(stored.phase)
      ? stored.questionIndex
      : stored.questionIndex - 1;
    const rows: TrendControl["recent"] = [];
    for (let index = Math.min(last, questions.length - 1); index >= 0; index -= 1) {
      if (rows.length >= 12) break;
      const question = questions[index]!;
      if (index === stored.questionIndex && trendPhases.has(stored.phase)) continue;
      let past = this.past.get(question.id);
      if (!past) {
        const input = readTrendInput(sql, questions, index);
        past = {
          prompt: question.prompt,
          analysis: input ? analyseTrends(input) : null,
        };
        this.past.set(question.id, past);
      }
      rows.push({
        questionId: question.id,
        prompt: clip(past.prompt, 240),
        responses: past.analysis?.responses ?? 0,
        // The same hidden cards as the live projector, whether or not this
        // question was revealed in this process.
        headlines: past.analysis
          ? pickStageCards(past.analysis, hidden)
              .slice(0, 3)
              .map((card) => card.headline)
          : [],
      });
    }
    return rows;
  }
}

function playableQuestions(stored: StoredRoom): readonly Question[] {
  const resolved = resolveContent(stored.questionSetVersion, stored.questionScript);
  return resolved.status === "playable" ? resolved.pack.questions : [];
}

/**
 * A fingerprint of everything `readTrendInput` reads, in one query: this
 * question's answers and scores, scores and adjustments so far, the roster
 * (names, photos, client class), device reports, reconnects and the laggy
 * threshold, trolls, uploads and the vote ballot. Raw round-trip times are
 * bucketed at the facet's 150 ms line, so routine ping updates do not
 * recompute the analysis every second during a reveal.
 */
function cacheKey(sql: SqlStorage, version: string, questionId: string): string {
  const row = sql
    .exec<Record<string, number | string | null>>(
      `SELECT
         (SELECT COUNT(*) || '/' || COALESCE(SUM(points), 0) || '/' || COALESCE(MAX(created_at), 0)
            FROM score_ledger WHERE question_id = ?) AS ledger,
         (SELECT COUNT(*) || '/' || COALESCE(SUM(points), 0) FROM score_ledger) AS totals,
         (SELECT COUNT(*) || '/' || COALESCE(SUM(points), 0) || '/' || COALESCE(MAX(created_at), 0)
            FROM score_adjustment) AS adjustments,
         (SELECT group_concat(player_id || '=' || nickname || '=' || client_class || '='
                   || COALESCE(avatar_media_id, '') || '=' || COALESCE(revoked_at, ''), '|')
            FROM player) AS roster,
         (SELECT COUNT(*) || '/' || COALESCE(MAX(created_at), 0) FROM device_context) AS devices,
         (SELECT COALESCE(SUM(reconnects), 0) || '/'
                   || COALESCE(SUM(CASE WHEN rtt_median_ms >= 150 THEN 1 ELSE 0 END), 0) || '/'
                   || COUNT(rtt_median_ms)
            FROM connection_summary) AS connections,
         (SELECT COUNT(*) || '/' || COALESCE(SUM(refunded), 0) FROM troll_effect) AS trolls,
         (SELECT COUNT(*) FROM media_upload WHERE status = 'accepted') AS uploads,
         (SELECT COUNT(*) || '/' || COALESCE(MAX(received_at), 0)
            FROM choice_answer WHERE question_id = ?) AS choices,
         (SELECT COUNT(*) || '/' || COALESCE(MAX(received_at), 0)
            FROM round_response WHERE question_id = ?) AS responses,
         (SELECT COUNT(*) || '/' || COALESCE(MAX(received_at), 0)
            FROM vote_ballot WHERE question_id = ?) AS ballots,
         (SELECT COUNT(*) || '/' || COALESCE(SUM(included), 0)
            FROM vote_candidate WHERE question_id = ?) AS candidates,
         (SELECT COUNT(*) || '/' || COALESCE(SUM(position_revision), 0)
            FROM chess_game WHERE round_id = ?) AS chess`,
      ...Array.from({ length: 6 }, () => questionId),
    )
    .toArray()[0];
  return [
    version,
    questionId,
    fingerprint(
      Object.values(row ?? {})
        .map((value) => String(value ?? ""))
        .join(";"),
    ),
    [...hiddenAuthors(sql, questionId)].sort().join(","),
  ].join(":");
}

/** FNV-1a, so a roster of eighty names becomes a short cache key. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}.${(hash >>> 0).toString(36)}`;
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}
