import { enterKart, tickKart, kartScores, projectKart } from "./kart.ts";
import { playSnapshotSchema, type PlaySnapshot } from "@26/shared";
import {
  submissionGate,
  wallAdvancePayload,
  type GameStore,
  type RoomClock,
  type RoomPhase,
  type RoundPlugin,
} from "../room/lifecycle.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { queueFinalExport } from "../archive/schedule.ts";
import { purgeDetailedTelemetry } from "../device/store.ts";
import { funFactTotal } from "../stats/fun-source.ts";
import { syncWall } from "../wall/queue.ts";
import { demoQuestionSetVersion, liveSampleSize } from "../room/limits.ts";
import {
  demoAnswerKeyMarker,
  type ChoiceQuestion,
  type DuelQuestion,
  type FinaleQuestion,
  type GuessQuestion,
  type RankQuestion,
  type SliderQuestion,
  type TypedQuestion,
  type WordleQuestion,
  type VoteQuestion,
} from "./definition.ts";
import {
  choiceTally,
  choiceWins,
  settleChoice,
  type ChoiceSettlement,
} from "./choice-outcome.ts";
import {
  publicTypedQuestion,
  readTypedAnswer,
  typedHostResponses,
  typedReveal,
  typedScores,
} from "./typed.ts";
import {
  publicWordleQuestion,
  readWordleBoard,
  wordleReveal,
  wordleScores,
  wordleProgress,
} from "./wordle.ts";
import { attachAudienceFields, publicQuestionCore } from "./project.ts";
import { questionFor, requirePlayable } from "./registry.ts";
import {
  publicRankQuestion,
  rankHostResponses,
  rankReveal,
  rankScores,
  readRanking,
} from "./rank.ts";
import {
  publicSliderQuestion,
  readEstimate,
  responseCount,
  responseNames,
  sliderHostResponses,
  sliderReveal,
  sliderScores,
} from "./slider.ts";
import { applyPointTransfers, applyScoreModifiers } from "../troll/catalogue.ts";
import {
  activeModifierKinds,
  activeTransfers,
  completeScheduledTroll,
  displayNickname,
  settleTrolls,
  submissionDisrupted,
} from "../troll/engine.ts";
import {
  duelPlayFields,
  freezeDuel,
  nextDemoIndex,
  scoreDuelQuestion,
} from "./duel.ts";
import {
  applyQuestionClock,
  ballotPlayFields,
  freezeGuess,
  freezeVote,
  nextBallotPhase,
  scoreBallotQuestion,
} from "./vote.ts";

import { sameAnswerSet } from "../../../../packages/shared/src/party-scoring.ts";

const scoredPhases: readonly RoomPhase[] = ["reveal", "scores", "final", "podium"];

/**
 * Accepted answers and the score ledger are the records later voting,
 * effects, and device context will extend. Those stages add their own
 * rows beside these. They do not score from the phone.
 */
export type ChoiceAnswer = {
  playerId: string;
  questionId: string;
  phaseGeneration: number;
  optionId: string;
  receivedAt: number;
  deadlineAt: number;
};

export function multipleChoicePlugin(): RoundPlugin {
  const windows = requirePlayable(demoQuestionSetVersion).questions.map(
    (question) => question.collectMs,
  );
  return {
    kind: "multiple-choice",
    phases: ["intro", "prompt", "collect", "reveal", "scores"],
    durations: {
      intro: 5_000,
      prompt: 8_000,
      collect: windows[0] ?? 20_000,
      reveal: 12_000,
      scores: 10_000,
      final: 8_000,
    },
    questionCount: windows.length,
    collectWindows: windows,
  };
}

/**
 * A poll scores nothing. A threshold outcome scores whoever the room's split
 * names, from `settlement`. Without one, the correct option wins.
 * Speed bonus uses the server receipt.
 * `receivedAt` is the Durable Object clock when the answer row is inserted.
 * `deadlineAt` is the collect job's due time read in that same transaction.
 * The phone does not send a timestamp. There is no score floor and no round multiplier.
 * bonus = floor(maxPoints * max(0, deadlineAt - receivedAt) / collectMs)
 */
export function pointsFor(
  question: ChoiceQuestion,
  answer: { optionId: string; receivedAt: number; deadlineAt: number } | undefined,
  troll?: { suppressSpeed: boolean; modifiers: readonly string[] },
  settlement: ChoiceSettlement = settleChoice(question, []),
): { points: number; detail: string } {
  if (question.outcome.kind === "multiple") {
    const correct = Boolean(
      answer && sameAnswerSet(answer.optionId.split(","), question.outcome.optionIds),
    );
    return {
      points: correct ? question.points : 0,
      detail: correct ? "correct-set" : answer ? "wrong-set" : "missing",
    };
  }
  if (!answer || !choiceWins(settlement, answer.optionId)) {
    return applyScoreModifiers(
      0,
      settlement.outcome === "poll" && answer ? "poll" : "miss",
      question.modifiers ?? [],
      troll?.modifiers ?? [],
    );
  }
  const bonus =
    troll?.suppressSpeed && question.suppressSpeedBonus
      ? 0
      : speedBonusPoints(question, answer.receivedAt, answer.deadlineAt);
  return applyScoreModifiers(
    question.points + bonus,
    bonus > 0 ? `correct+${bonus}` : "correct",
    question.modifiers ?? [],
    troll?.modifiers ?? [],
  );
}

export function speedBonusPoints(
  question: ChoiceQuestion,
  receivedAt: number,
  deadlineAt: number,
): number {
  if (!question.speedBonus) {
    return 0;
  }
  const remaining = Math.max(0, deadlineAt - receivedAt);
  return Math.floor((question.speedBonus.maxPoints * remaining) / question.collectMs);
}

export function createGameStore(sql: SqlStorage): GameStore {
  const store = createSqlStore(sql);
  return {
    ...store,
    onEnterPhase(room, now) {
      if (room.phase === "podium") {
        queueFinalExport(sql, now);
      }
      settleTrolls(sql, createSqlStore(sql).readRoom(), now);
      applyQuestionClock(createSqlStore(sql));
      const current = createSqlStore(sql).readRoom();
      const question = questionFor(current);
      if (question?.kind === "kart") enterKart(sql, createSqlStore(sql), question, now);
      if (
        current.questionCount > 0 &&
        question?.kind === "vote" &&
        current.phase === "vote"
      ) {
        freezeVote(sql, question, now);
      }
      if (
        current.questionCount > 0 &&
        question?.kind === "guess" &&
        current.phase === "collect"
      ) {
        freezeGuess(sql, question, now);
      }
      if (
        current.questionCount > 0 &&
        (question?.kind === "duel" || question?.kind === "finale") &&
        current.phase === "intro"
      ) {
        freezeDuel(sql, question, now);
      }
      if (current.phase === "reveal" && current.questionCount > 0) {
        recordRevealScores(sql, current, now);
      }
      // A break may have started, or a question begun; the wall decides.
      syncWall(sql, "tick", now);
    },
    nextPhaseOverride(room) {
      if (room.phase === "final" && funFactTotal(sql) > 0) {
        return "facts";
      }
      const question = questionFor(room);
      return question?.kind === "vote"
        ? nextBallotPhase(sql, question, room)
        : undefined;
    },
    funFactCount() {
      return funFactTotal(sql);
    },
    nextQuestionIndex(room) {
      if (room.questionCount <= 0) {
        return room.questionIndex + 1;
      }
      return nextDemoIndex(sql, room);
    },
    onScheduledJob(job, now) {
      const question = questionFor(store.readRoom());
      if (job.payload === "kart-tick" && question?.kind === "kart") {
        tickKart(sql, createGameStore(sql), question, job, now);
        return;
      }
      completeScheduledTroll(sql, job, now);
    },
    onBackgroundJob(job, now) {
      if (job.payload === wallAdvancePayload) {
        syncWall(sql, "tick", now);
        return;
      }
      purgeDetailedTelemetry(sql, now);
    },
  };
}

export function acceptChoice(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  optionId: string,
  now: number,
):
  | { ok: true }
  | {
      ok: false;
      reason: "phase" | "paused" | "held" | "late" | "duplicate" | "option";
    } {
  const gate = submissionGate(store, now);
  if (!gate.ok) {
    return gate;
  }
  const room = store.readRoom();
  if (room.phase !== "collect") {
    return { ok: false, reason: "phase" };
  }
  const question = questionFor(room);
  if (
    !question ||
    question.kind !== "choice" ||
    question.outcome.kind === "multiple" ||
    !question.options.some((option) => option.id === optionId)
  ) {
    return { ok: false, reason: "option" };
  }
  const existing = sql
    .exec<{ option_id: string }>(
      `SELECT option_id FROM choice_answer WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (existing) {
    return { ok: false, reason: "duplicate" };
  }
  const deadline = store
    .jobs()
    .find(
      (job) =>
        job.jobType === "gameplay" &&
        job.status === "pending" &&
        job.phase === "collect" &&
        job.phaseGeneration === room.phaseGeneration,
    )?.dueAt;
  if (deadline === null || deadline === undefined) {
    return { ok: false, reason: "late" };
  }
  sql.exec(
    `INSERT INTO choice_answer (
       player_id, question_id, phase_generation, option_id, received_at, deadline_at,
       device_context_id
     ) VALUES (?, ?, ?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    room.phaseGeneration,
    optionId,
    now,
    deadline,
    playerId,
  );
  return { ok: true };
}

export function recordRevealScores(
  sql: SqlStorage,
  room: RoomClock,
  now: number,
): void {
  const question = questionFor(room);
  if (!question) {
    return;
  }
  if (question.kind === "kart") {
    kartScores(sql, createSqlStore(sql), question, now);
    return;
  }
  if (question.kind === "slider") {
    sliderScores(sql, question, now);
    return;
  }
  if (question.kind === "rank") {
    rankScores(sql, question, now);
    return;
  }
  if (question.kind === "vote" || question.kind === "guess") {
    scoreBallotQuestion(sql, question, now);
    return;
  }
  if (question.kind === "duel" || question.kind === "finale") {
    scoreDuelQuestion(sql, question, now);
    return;
  }
  if (question.kind === "wordle") {
    wordleScores(sql, question, now);
    return;
  }
  if (question.kind === "typed") {
    typedScores(sql, question, now);
    return;
  }
  const players = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray();
  const answers = new Map(
    sql
      .exec<{
        player_id: string;
        option_id: string;
        received_at: number;
        deadline_at: number;
      }>(
        `SELECT player_id, option_id, received_at, deadline_at
         FROM choice_answer WHERE question_id = ?`,
        question.id,
      )
      .toArray()
      .map((row) => [row.player_id, row] as const),
  );
  const settlement = settleChoice(
    question,
    [...answers.values()].map((row) => row.option_id),
  );
  const awards = new Map<string, { points: number; detail: string }>();
  for (const player of players) {
    const answer = answers.get(player.player_id);
    awards.set(
      player.player_id,
      pointsFor(
        question,
        answer
          ? {
              optionId: answer.option_id,
              receivedAt: answer.received_at,
              deadlineAt: answer.deadline_at,
            }
          : undefined,
        {
          suppressSpeed: answer
            ? submissionDisrupted(sql, player.player_id, answer.received_at)
            : false,
          modifiers: activeModifierKinds(sql, player.player_id, room.questionIndex),
        },
        settlement,
      ),
    );
  }
  // Points-moving trolls run once every award is known, and only when the
  // question opts in to that kind.
  const allowed = (question.modifiers ?? []) as readonly string[];
  const transfers = activeTransfers(sql, room.questionIndex).filter(
    (transfer) => allowed.includes(transfer.kind) && awards.has(transfer.targetId),
  );
  const settled = applyPointTransfers(awards, transfers, (excludeId) =>
    lastPlaceGuest(sql, excludeId),
  );
  for (const [playerId, scored] of settled) {
    sql.exec(
      `INSERT OR IGNORE INTO score_ledger (
         question_id, player_id, points, detail, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      question.id,
      playerId,
      scored.points,
      scored.detail,
      now,
    );
  }
}

/**
 * The guest with the lowest total before this question (ledger plus host
 * adjustments), for Robin Hood. Ties go to whoever joined first. Never the
 * excluded player, and never a host, test or synthetic client.
 */
function lastPlaceGuest(sql: SqlStorage, excludeId: string): string | null {
  return (
    sql
      .exec<{ player_id: string }>(
        `SELECT player.player_id,
                COALESCE((SELECT SUM(points) FROM score_ledger
                          WHERE score_ledger.player_id = player.player_id), 0) +
                COALESCE((SELECT SUM(points) FROM score_adjustment
                          WHERE score_adjustment.player_id = player.player_id), 0) AS total
         FROM player
         WHERE player.revoked_at IS NULL AND player.client_class = 'guest'
           AND player.player_id != ?
         ORDER BY total ASC, player.rowid ASC
         LIMIT 1`,
        excludeId,
      )
      .toArray()[0]?.player_id ?? null
  );
}

export function ledgerTotal(sql: SqlStorage): number {
  const row = sql
    .exec<{ total: number | null }>(`SELECT SUM(points) AS total FROM score_ledger`)
    .toArray()[0];
  return row?.total ?? 0;
}

export function ledgerCount(sql: SqlStorage): number {
  const row = sql
    .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM score_ledger`)
    .toArray()[0];
  return row?.total ?? 0;
}

function parsePlay(
  view: object,
  question: { notes?: string; explanation?: string },
  audience: "guest" | "stage" | "control",
  scored: boolean,
): PlaySnapshot {
  const sealed = attachAudienceFields(view, question, audience, scored);
  const text = JSON.stringify(sealed);
  if (text.includes(demoAnswerKeyMarker)) {
    throw new Error("The public quiz view included the answer-key marker.");
  }
  if (audience !== "control" && question.notes && text.includes(question.notes)) {
    throw new Error("The public quiz view included presenter notes.");
  }
  if (!scored && question.explanation && text.includes(question.explanation)) {
    throw new Error("The public quiz view included a future reveal.");
  }
  return playSnapshotSchema.parse(sealed);
}

export function projectPlay(
  sql: SqlStorage,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId?: string,
  stageHidden = false,
): PlaySnapshot | null {
  if (room.phase === "lobby" || room.questionCount <= 0) {
    return null;
  }
  const question = questionFor(room);
  if (!question || (audience === "stage" && stageHidden)) {
    return null;
  }
  const scored = scoredPhases.includes(room.phase);
  if (question.kind === "kart") {
    const view = projectKart(
      sql,
      question,
      room,
      audience === "guest" ? selfPlayerId : undefined,
    );
    const selfRow =
      audience === "guest" && selfPlayerId
        ? standings(sql).find((d) => d.playerId === selfPlayerId)
        : undefined;
    return parsePlay(
      {
        ...view,
        selfStanding:
          scored && selfRow
            ? {
                place: selfRow.place,
                points: selfRow.points,
                players: standings(sql).length,
              }
            : null,
        standings:
          audience !== "guest" && scored
            ? standings(sql).map(({ place, nickname, points }) => ({
                place,
                nickname,
                points,
              }))
            : null,
      },
      question,
      audience,
      scored,
    );
  }
  if (question.kind === "vote" || question.kind === "guess") {
    return projectBallot(sql, room, audience, selfPlayerId, question, scored);
  }
  if (question.kind === "duel" || question.kind === "finale") {
    return projectDuel(sql, room, audience, selfPlayerId, question, scored);
  }
  if (question.kind !== "choice") {
    return projectSpecial(sql, room, audience, selfPlayerId, question, scored);
  }
  const countRow = sql
    .exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM choice_answer WHERE question_id = ?`,
      question.id,
    )
    .toArray()[0];
  const self = selfPlayerId
    ? sql
        .exec<{ option_id: string }>(
          `SELECT option_id FROM choice_answer WHERE player_id = ? AND question_id = ?`,
          selfPlayerId,
          question.id,
        )
        .toArray()[0]
    : undefined;
  const totals = standings(sql);
  const anyPoints = totals.some((row) => row.points > 0);
  const showStanding = scored || anyPoints;
  const selfRow = selfPlayerId
    ? totals.find((row) => row.playerId === selfPlayerId)
    : undefined;
  const view = {
    question: {
      ...publicQuestionCore(question, room.questionIndex + 1, room.questionCount),
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.image ? { image: option.image } : {}),
      })),
      kind: "choice" as const,
      ...(question.outcome.kind === "correct"
        ? {}
        : { outcome: question.outcome.kind }),
      speedBonus: question.speedBonus !== null,
      modifiers: [...(question.modifiers ?? [])],
      suppressSpeedBonus: question.suppressSpeedBonus === true,
    },
    submissionCount: countRow?.total ?? 0,
    selfAnswer: self
      ? question.outcome.kind === "multiple"
        ? { kind: "multiple" as const, optionIds: self.option_id.split(",") }
        : { kind: "choice" as const, optionId: self.option_id }
      : null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal: scored ? choiceReveal(sql, question) : null,
    selfAward: selfAward(sql, question.id, audience, scored, selfPlayerId),
    selfStanding:
      audience === "guest" && showStanding && selfRow
        ? { place: selfRow.place, points: selfRow.points, players: totals.length }
        : null,
    standings:
      audience === "guest" || !showStanding
        ? null
        : totals.map((row) => ({
            place: row.place,
            nickname: row.nickname,
            points: row.points,
          })),
    liveSample: liveNames(sql, question, room),
    attributions: publicAttributions(sql, question, room),
    ...(audience === "control"
      ? question.outcome.kind === "multiple"
        ? {
            hostResponses: hostAnswerRows(sql, question.id).map((row) => ({
              playerId: row.playerId,
              nickname: row.nickname,
              summary: row.optionId
                .split(",")
                .map((id) => question.options.find((o) => o.id === id)?.label ?? id)
                .join(", ")
                .slice(0, 200),
            })),
          }
        : { hostAnswers: hostAnswerRows(sql, question.id) }
      : {}),
  };
  return parsePlay(view, question, audience, scored);
}

/** An ordinary question keeps its one-field reveal. Polls and thresholds add the room's split. */
function choiceReveal(sql: SqlStorage, question: ChoiceQuestion) {
  if (question.outcome.kind === "multiple")
    return {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "multiple" as const,
      correctOptionIds: [...question.outcome.optionIds],
    };
  if (question.outcome.kind === "correct") {
    return { kind: "choice" as const, correctOptionId: question.correctOptionId };
  }
  const answers = sql
    .exec<{ option_id: string }>(
      `SELECT choice_answer.option_id FROM choice_answer
       JOIN player ON player.player_id = choice_answer.player_id
       WHERE choice_answer.question_id = ? AND player.revoked_at IS NULL`,
      question.id,
    )
    .toArray()
    .map((row) => row.option_id);
  const settlement = settleChoice(question, answers);
  return {
    kind: "choice" as const,
    correctOptionId: null,
    outcome: question.outcome.kind,
    tally: choiceTally(question.options, answers),
    winners: [...settlement.optionIds],
    everyone: settlement.everyone,
    met: settlement.met,
  };
}

function projectBallot(
  sql: SqlStorage,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  question: VoteQuestion | GuessQuestion,
  scored: boolean,
): PlaySnapshot | null {
  const totals = standings(sql);
  const anyPoints = totals.some((row) => row.points > 0);
  const showStanding = scored || anyPoints;
  const selfRow = selfPlayerId
    ? totals.find((row) => row.playerId === selfPlayerId)
    : undefined;
  const view = {
    ...ballotPlayFields(sql, question, room, audience, selfPlayerId, scored),
    selfAward: selfAward(sql, question.id, audience, scored, selfPlayerId),
    selfStanding:
      audience === "guest" && showStanding && selfRow
        ? { place: selfRow.place, points: selfRow.points, players: totals.length }
        : null,
    standings:
      audience === "guest" || !showStanding
        ? null
        : totals.map((row) => ({
            place: row.place,
            nickname: row.nickname,
            points: row.points,
          })),
    attributions: null,
    duel: null,
  };
  return parsePlay(view, question, audience, scored);
}

function projectDuel(
  sql: SqlStorage,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  question: DuelQuestion | FinaleQuestion,
  scored: boolean,
): PlaySnapshot | null {
  const totals = standings(sql);
  const anyPoints = totals.some((row) => row.points > 0);
  const showStanding = scored || anyPoints;
  const selfRow = selfPlayerId
    ? totals.find((row) => row.playerId === selfPlayerId)
    : undefined;
  const view = {
    ...duelPlayFields(sql, question, room, audience, selfPlayerId, scored),
    selfAward: selfAward(sql, question.id, audience, scored, selfPlayerId),
    selfStanding:
      audience === "guest" && showStanding && selfRow
        ? { place: selfRow.place, points: selfRow.points, players: totals.length }
        : null,
    standings:
      audience === "guest" || !showStanding
        ? null
        : totals.map((row) => ({
            place: row.place,
            nickname: row.nickname,
            points: row.points,
          })),
    attributions: null,
  };
  return parsePlay(view, question, audience, scored);
}

export function projectSpecial(
  sql: SqlStorage,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  question: SliderQuestion | RankQuestion | TypedQuestion | WordleQuestion,
  scored: boolean,
): PlaySnapshot | null {
  const totals = standings(sql);
  const anyPoints = totals.some((row) => row.points > 0);
  const showStanding = scored || anyPoints;
  const selfRow = selfPlayerId
    ? totals.find((row) => row.playerId === selfPlayerId)
    : undefined;
  const showNames = audience === "control" || question.attribution !== "never";
  const index = room.questionIndex + 1;
  const estimate =
    question.kind === "slider"
      ? readEstimate(sql, selfPlayerId ?? "", question.id)
      : undefined;
  const ranking =
    question.kind === "rank"
      ? readRanking(sql, selfPlayerId ?? "", question)
      : undefined;
  const typed =
    question.kind === "typed"
      ? readTypedAnswer(sql, selfPlayerId ?? "", question.id)
      : undefined;
  const board =
    question.kind === "wordle" && audience === "guest" && selfPlayerId
      ? readWordleBoard(sql, selfPlayerId, question.id)
      : undefined;
  const view = {
    question:
      question.kind === "wordle"
        ? publicWordleQuestion(question, index, room.questionCount)
        : question.kind === "slider"
          ? publicSliderQuestion(question, index, room.questionCount)
          : question.kind === "typed"
            ? publicTypedQuestion(question, index, room.questionCount)
            : publicRankQuestion(question, index, room.questionCount),
    submissionCount:
      question.kind === "wordle"
        ? wordleProgress(sql, question.id).finishedCount
        : responseCount(sql, question.id),
    selfAnswer: board
      ? board
      : question.kind === "slider" && estimate !== undefined
        ? { kind: "slider" as const, value: estimate }
        : question.kind === "rank" && ranking
          ? { kind: "rank" as const, placements: ranking }
          : question.kind === "typed" && typed !== undefined
            ? { kind: "text" as const, body: typed }
            : null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal:
      question.kind === "wordle"
        ? wordleReveal(sql, question, scored)
        : question.kind === "slider"
          ? sliderReveal(sql, question, scored, showNames && scored)
          : question.kind === "typed"
            ? typedReveal(sql, question, scored, showNames && scored)
            : rankReveal(sql, question, scored, showNames && scored),
    selfAward: selfAward(sql, question.id, audience, scored, selfPlayerId),
    selfStanding:
      audience === "guest" && showStanding && selfRow
        ? { place: selfRow.place, points: selfRow.points, players: totals.length }
        : null,
    standings:
      audience === "guest" || !showStanding
        ? null
        : totals.map((row) => ({
            place: row.place,
            nickname: row.nickname,
            points: row.points,
          })),
    liveSample:
      question.kind === "wordle"
        ? null
        : responseNames(
            sql,
            question.id,
            question.attribution,
            room.phase,
            liveSampleSize,
          ),
    attributions: null,
    ...(audience === "control"
      ? {
          hostResponses:
            question.kind === "wordle"
              ? []
              : question.kind === "slider"
                ? sliderHostResponses(sql, question)
                : question.kind === "typed"
                  ? typedHostResponses(sql, question)
                  : rankHostResponses(sql, question),
        }
      : {}),
  };
  return parsePlay(view, question, audience, scored);
}

function selfAward(
  sql: SqlStorage,
  questionId: string,
  audience: "guest" | "stage" | "control",
  scored: boolean,
  selfPlayerId?: string,
): number | null {
  if (!scored || audience !== "guest" || !selfPlayerId) {
    return null;
  }
  const row = sql
    .exec<{ points: number }>(
      `SELECT points FROM score_ledger WHERE question_id = ? AND player_id = ?`,
      questionId,
      selfPlayerId,
    )
    .toArray()[0];
  return row?.points ?? 0;
}

function liveNames(
  sql: SqlStorage,
  question: ChoiceQuestion,
  room: RoomClock,
): string[] | null {
  if (question.attribution !== "live" || room.phase !== "collect") {
    return null;
  }
  const rows = sql
    .exec<{ nickname: string }>(
      `SELECT player.nickname FROM choice_answer
       JOIN player ON player.player_id = choice_answer.player_id
       WHERE choice_answer.question_id = ? AND player.revoked_at IS NULL
       ORDER BY choice_answer.received_at DESC, player.rowid DESC
       LIMIT ?`,
      question.id,
      liveSampleSize,
    )
    .toArray();
  return rows.map((row) => row.nickname).reverse();
}

function publicAttributions(
  sql: SqlStorage,
  question: ChoiceQuestion,
  room: RoomClock,
): { optionId: string; nicknames: string[] }[] | null {
  if (question.attribution === "never" || !scoredPhases.includes(room.phase)) {
    return null;
  }
  const rows = sql
    .exec<{ option_id: string; nickname: string }>(
      `SELECT choice_answer.option_id, player.nickname
       FROM choice_answer
       JOIN player ON player.player_id = choice_answer.player_id
       WHERE choice_answer.question_id = ? AND player.revoked_at IS NULL
       ORDER BY player.rowid ASC`,
      question.id,
    )
    .toArray();
  return question.options.map((option) => ({
    optionId: option.id,
    nicknames: rows
      .filter((row) =>
        question.outcome.kind === "multiple"
          ? row.option_id.split(",").includes(option.id)
          : row.option_id === option.id,
      )
      .map((row) => row.nickname),
  }));
}

function hostAnswerRows(
  sql: SqlStorage,
  questionId: string,
): { playerId: string; nickname: string; optionId: string }[] {
  return sql
    .exec<{ player_id: string; nickname: string; option_id: string }>(
      `SELECT choice_answer.player_id, player.nickname, choice_answer.option_id
       FROM choice_answer
       JOIN player ON player.player_id = choice_answer.player_id
       WHERE choice_answer.question_id = ? AND player.revoked_at IS NULL
       ORDER BY choice_answer.received_at ASC`,
      questionId,
    )
    .toArray()
    .map((row) => ({
      playerId: row.player_id,
      nickname: row.nickname,
      optionId: row.option_id,
    }));
}

function standings(sql: SqlStorage): {
  place: number;
  nickname: string;
  points: number;
  playerId: string;
}[] {
  const rows = sql
    .exec<{ player_id: string; nickname: string; points: number }>(
      `SELECT player.player_id, player.nickname,
              COALESCE((SELECT SUM(points) FROM score_ledger WHERE player_id = player.player_id), 0)
              + COALESCE((SELECT SUM(points) FROM score_adjustment WHERE player_id = player.player_id), 0)
              AS points
       FROM player
       WHERE player.revoked_at IS NULL
       ORDER BY points DESC, player.nickname ASC`,
    )
    .toArray();
  let place = 0;
  let previous = Number.POSITIVE_INFINITY;
  return rows.map((row, index) => {
    if (row.points !== previous) {
      place = index + 1;
      previous = row.points;
    }
    return {
      place,
      nickname: displayNickname(sql, row.player_id, row.nickname),
      points: row.points,
      playerId: row.player_id,
    };
  });
}
