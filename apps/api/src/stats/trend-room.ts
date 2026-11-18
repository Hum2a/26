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
 * when its reveal opens and again only if its scores, players, device reports
 * or hidden answers change, so a broadcast to eighty phones reuses it. Past
 * questions are summarised once for the host. After a restart the cache
 * rebuilds from SQL; it is never the authority for anything.
 */
export class TrendCache {
  private current: { key: string; analysis: TrendAnalysis | null; prompt: string } | null =
    null;
  private lines = new Map<string, SelfTrends | null>();
  private past = new Map<
    string,
    { prompt: string; responses: number; headlines: string[] }
  >();

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
    const stage = analysis ? pickStageCards(analysis, new Set(settings.hiddenCards)) : [];
    if (analysis) {
      this.past.set(question.id, {
        prompt: question.prompt,
        responses: analysis.responses,
        headlines: stage.slice(0, 3).map((card) => card.headline),
      });
    }
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
      recent: this.recent(sql, stored),
    };
  }

  /** Up to twelve earlier questions, newest first, summarised once each. */
  private recent(sql: SqlStorage, stored: StoredRoom): TrendControl["recent"] {
    const questions = playableQuestions(stored);
    const last = doneQuestionPhases.has(stored.phase)
      ? stored.questionIndex
      : stored.questionIndex - 1;
    const rows: TrendControl["recent"] = [];
    for (let index = Math.min(last, questions.length - 1); index >= 0; index -= 1) {
      if (rows.length >= 12) break;
      const question = questions[index]!;
      if (index === stored.questionIndex && trendPhases.has(stored.phase)) continue;
      let summary = this.past.get(question.id);
      if (!summary) {
        const input = readTrendInput(sql, questions, index);
        const analysis = input ? analyseTrends(input) : null;
        summary = {
          prompt: question.prompt,
          responses: analysis?.responses ?? 0,
          headlines: analysis
            ? pickStageCards(analysis)
                .slice(0, 3)
                .map((card) => card.headline)
            : [],
        };
        this.past.set(question.id, summary);
      }
      rows.push({
        questionId: question.id,
        prompt: clip(summary.prompt, 240),
        responses: summary.responses,
        headlines: summary.headlines,
      });
    }
    return rows;
  }
}

function playableQuestions(stored: StoredRoom): readonly Question[] {
  const resolved = resolveContent(stored.questionSetVersion, stored.questionScript);
  return resolved.status === "playable" ? resolved.pack.questions : [];
}

function cacheKey(sql: SqlStorage, version: string, questionId: string): string {
  const ledger = sql
    .exec<{ n: number; s: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(points), 0) AS s FROM score_ledger WHERE question_id = ?`,
      questionId,
    )
    .toArray()[0];
  const players = sql
    .exec<{ n: number }>(`SELECT COUNT(*) AS n FROM player WHERE revoked_at IS NULL`)
    .toArray()[0];
  const devices = sql
    .exec<{ n: number }>(`SELECT COUNT(*) AS n FROM device_context`)
    .toArray()[0];
  return [
    version,
    questionId,
    ledger?.n ?? 0,
    ledger?.s ?? 0,
    players?.n ?? 0,
    devices?.n ?? 0,
    [...hiddenAuthors(sql, questionId)].sort().join(","),
  ].join(":");
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}
