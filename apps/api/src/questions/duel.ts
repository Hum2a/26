import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerHeldMessage,
  answerLateMessage,
  answerPausedMessage,
  duelClosedMessage,
  duelInvalidMessage,
  duelLateMessage,
  duelRoleMessage,
  duelStepMessage,
  predictionClosedMessage,
  predictionContestantMessage,
  predictionUnknownMessage,
} from "../room/limits.ts";
import {
  submissionGate,
  type GameStore,
  type RoomClock,
  type RoomPhase,
} from "../room/lifecycle.ts";
import {
  assertCollectWindow,
  demoQuestionAt,
  demoQuestions,
  type AttributionMode,
  type DuelQuestion,
  type FinaleQuestion,
} from "./demo-set.ts";
import { shuffleIds, stageCardCap } from "./vote.ts";

const stepTolerance = 1e-8;

export type DuelSeat = {
  playerId: string;
  value: number | null;
  receivedAt: number | null;
};

export type DuelAward = { playerId: string; points: number; detail: string };

type Scale = {
  minimum: number;
  maximum: number;
  step: number;
  target: number;
  within: number;
  points: number;
  tie: "shared";
  absence: "forfeit";
  lateJoin: "ineligible";
  tieBreak: "off" | "tied";
};

/**
 * Each tied duel pays the question's own points to every winner. A missing
 * opponent forfeits when the deadline ends. Receipt time does not break a tie.
 * The loser receives 0, not a universal penalty.
 */
export function resolvePair(input: {
  left: DuelSeat;
  right: DuelSeat | null;
  target: number;
  within: number;
  points: number;
}): DuelAward[] {
  if (!input.right) {
    return [scoreSolo(input.left, input.target, input.within, input.points)];
  }
  if (input.left.value === null && input.right.value === null) {
    return [missing(input.left.playerId), missing(input.right.playerId)];
  }
  if (input.left.value === null) {
    return [missing(input.left.playerId), win(input.right.playerId, input.points)];
  }
  if (input.right.value === null) {
    return [win(input.left.playerId, input.points), missing(input.right.playerId)];
  }
  const leftDistance = Math.abs(input.left.value - input.target);
  const rightDistance = Math.abs(input.right.value - input.target);
  if (leftDistance === rightDistance) {
    return [
      tie(input.left.playerId, input.points),
      tie(input.right.playerId, input.points),
    ];
  }
  if (leftDistance < rightDistance) {
    return [win(input.left.playerId, input.points), miss(input.right.playerId)];
  }
  return [miss(input.left.playerId), win(input.right.playerId, input.points)];
}

export function awardsForPrediction(input: {
  predictionPoints: number;
  winnerIds: readonly string[];
  predictions: readonly { playerId: string; contestantId: string }[];
  spectatorIds: readonly string[];
}): DuelAward[] {
  const winners = new Set(input.winnerIds);
  return input.spectatorIds.map((playerId) => {
    if (winners.size === 0) {
      return { playerId, points: 0, detail: "missing" };
    }
    const pick = input.predictions.find(
      (prediction) => prediction.playerId === playerId,
    );
    if (!pick) {
      return { playerId, points: 0, detail: "missing" };
    }
    if (!winners.has(pick.contestantId)) {
      return { playerId, points: 0, detail: "miss" };
    }
    return {
      playerId,
      points: input.predictionPoints,
      detail: winners.size > 1 ? "tie" : "win",
    };
  });
}

export function leadersTied(points: readonly number[]): boolean {
  if (points.length < 2) {
    return false;
  }
  const top = Math.max(...points);
  return points.filter((value) => value === top).length >= 2;
}

export function pairIds(
  ids: readonly string[],
  seed: string,
): { leftId: string; rightId: string | null }[] {
  const order = shuffleIds(ids, seed, "duel");
  const pairs: { leftId: string; rightId: string | null }[] = [];
  for (let index = 0; index < order.length; index += 2) {
    const leftId = order[index];
    if (!leftId) {
      continue;
    }
    pairs.push({ leftId, rightId: order[index + 1] ?? null });
  }
  return pairs;
}

export function visiblePairs<T>(pairs: readonly T[], cap: number): T[] {
  return pairs.slice(0, cap);
}

export function nextDemoIndex(sql: SqlStorage, room: RoomClock): number | "final" {
  let index = room.questionIndex + 1;
  const totals = pointTotals(sql);
  while (index < room.questionCount) {
    const question = demoQuestionAt(index);
    if (
      !question ||
      (question.kind !== "duel" && question.kind !== "finale") ||
      question.tieBreak !== "tied" ||
      leadersTied(totals)
    ) {
      return index;
    }
    index += 1;
  }
  return "final";
}

export function assertDuelQuestion(question: DuelQuestion | FinaleQuestion): void {
  assertScale(question);
  if (question.tie !== "shared") {
    throw new Error("A tied duel pays this question's points to each winner.");
  }
  if (question.absence !== "forfeit") {
    throw new Error("A missing opponent forfeits when the duel closes.");
  }
  if (question.lateJoin !== "ineligible") {
    throw new Error("A player who joins after the pairs freeze cannot enter the duel.");
  }
  if (question.tieBreak !== "off" && question.tieBreak !== "tied") {
    throw new Error("Say whether this duel is the tie-break.");
  }
  if (question.kind === "duel" && question.odd !== "solo") {
    throw new Error("An odd player faces the target. They are not dropped.");
  }
  if (question.kind === "finale") {
    assertCollectWindow(question.predictMs);
    if (!Number.isInteger(question.predictionPoints) || question.predictionPoints < 0) {
      throw new Error("Prediction points have to be a whole number from 0 up.");
    }
    if (question.predictionPoints > 1000) {
      throw new Error("Prediction points stay inside the question transport cap.");
    }
    const names = question.contestants.map((name) => name.toLowerCase());
    if (question.contestants.length !== 2 || names[0] === names[1]) {
      throw new Error("A spectated finale names two different contestants.");
    }
  }
}

export function acceptDuel(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: DuelQuestion | FinaleQuestion,
): { ok: true } | { ok: false; message: string } {
  if (store.readRoom().phase !== "collect") {
    return { ok: false, message: duelClosedMessage };
  }
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  const role = readRole(sql, question.id, playerId);
  if (!role) {
    return { ok: false, message: duelLateMessage };
  }
  if (role !== "player") {
    return { ok: false, message: duelRoleMessage };
  }
  const checked = checkNumber(question, value);
  if (!checked.ok) {
    return checked;
  }
  const existing = sql
    .exec(
      `SELECT player_id FROM duel_answer WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (existing) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const room = store.readRoom();
  const deadline = phaseDeadline(store, room.phaseGeneration, "collect");
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO duel_answer (
       player_id, question_id, value, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    checked.value,
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function acceptPrediction(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: FinaleQuestion,
): { ok: true } | { ok: false; message: string } {
  if (store.readRoom().phase !== "predict") {
    return { ok: false, message: predictionClosedMessage };
  }
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  const role = readRole(sql, question.id, playerId);
  if (!role) {
    return { ok: false, message: duelLateMessage };
  }
  if (role !== "spectator") {
    return { ok: false, message: predictionContestantMessage };
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,36}$/.test(value)) {
    return { ok: false, message: predictionUnknownMessage };
  }
  const contestant = readRole(sql, question.id, value);
  if (contestant !== "player" || isRevoked(sql, value)) {
    return { ok: false, message: predictionUnknownMessage };
  }
  const existing = sql
    .exec(
      `SELECT player_id FROM duel_prediction WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (existing) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const room = store.readRoom();
  const deadline = phaseDeadline(store, room.phaseGeneration, "predict");
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO duel_prediction (
       player_id, question_id, contestant_id, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    value,
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function freezeDuel(
  sql: SqlStorage,
  question: DuelQuestion | FinaleQuestion,
  now: number,
): void {
  if (frozen(sql, question.id)) {
    return;
  }
  const seed = crypto.randomUUID();
  const players = activePlayers(sql);
  if (question.kind === "finale") {
    const present = question.contestants.flatMap((name) => {
      const player = players.find(
        (item) => item.nickname.toLowerCase() === name.toLowerCase(),
      );
      return player ? [player.player_id] : [];
    });
    const pairs =
      present.length === 2
        ? [{ leftId: present[0] ?? "", rightId: present[1] ?? null }]
        : present.length === 1
          ? [{ leftId: present[0] ?? "", rightId: null }]
          : [];
    writePairs(sql, question.id, pairs, players, new Set(present));
  } else {
    const pairs = pairIds(
      players.map((player) => player.player_id),
      seed,
    );
    writePairs(
      sql,
      question.id,
      pairs,
      players,
      new Set(players.map((player) => player.player_id)),
    );
  }
  sql.exec(
    `INSERT INTO duel_freeze (question_id, seed, frozen_at) VALUES (?, ?, ?)`,
    question.id,
    seed,
    now,
  );
}

export function scoreDuelQuestion(
  sql: SqlStorage,
  question: DuelQuestion | FinaleQuestion,
  now: number,
): void {
  const pairs = readPairs(sql, question.id);
  const answers = readAnswers(sql, question.id);
  const awards = new Map<string, DuelAward>();
  const winnerIds: string[] = [];
  for (const pair of pairs) {
    const resolved = resolvePair({
      left: seat(pair.left_id, answers, sql),
      right: pair.right_id ? seat(pair.right_id, answers, sql) : null,
      target: question.target,
      within: question.within,
      points: question.points,
    });
    for (const award of resolved) {
      awards.set(award.playerId, award);
      if (award.points > 0) {
        winnerIds.push(award.playerId);
      }
    }
  }
  if (question.kind === "finale") {
    const spectators = readRoles(sql, question.id, "spectator").filter(
      (playerId) => !isRevoked(sql, playerId),
    );
    const predictions = readPredictions(sql, question.id);
    for (const award of awardsForPrediction({
      predictionPoints: question.predictionPoints,
      winnerIds,
      predictions: predictions.map((prediction) => ({
        playerId: prediction.player_id,
        contestantId: prediction.contestant_id,
      })),
      spectatorIds: spectators,
    })) {
      awards.set(award.playerId, award);
    }
  }
  for (const player of activePlayers(sql)) {
    const award = awards.get(player.player_id) ?? missing(player.player_id);
    sql.exec(
      `INSERT OR IGNORE INTO score_ledger (
         question_id, player_id, points, detail, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      question.id,
      award.playerId,
      award.points,
      award.detail,
      now,
    );
  }
}

export function duelPlayFields(
  sql: SqlStorage,
  question: DuelQuestion | FinaleQuestion,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  scored: boolean,
) {
  const pairs = readPairs(sql, question.id);
  const answers = readAnswers(sql, question.id);
  const predictions = readPredictions(sql, question.id);
  const role = selfPlayerId
    ? snapshotRole(sql, question.id, selfPlayerId, pairs)
    : "late";
  const opponent = selfPlayerId ? opponentOf(sql, pairs, selfPlayerId) : null;
  const answering = room.phase === "collect" && (role === "pair" || role === "solo");
  const predicting = room.phase === "predict" && role === "spectator";
  const reason =
    role === "late" ? "late" : answering || predicting ? "open" : waiting(room, role);
  const present = pairs.flatMap((pair) =>
    [pair.left_id, pair.right_id].flatMap((id) => (id ? [id] : [])),
  );
  const cards =
    question.kind === "finale"
      ? present.map((id) => ({
          id,
          label: nicknameOf(sql, id) ?? "Player",
          selectable: predicting && !isRevoked(sql, id),
        }))
      : [];
  const boardRows = pairs.map((pair) => ({
    left: nicknameOf(sql, pair.left_id) ?? "Player",
    right: pair.right_id ? nicknameOf(sql, pair.right_id) : null,
  }));
  const shown = visiblePairs(boardRows, stageCardCap);
  const results = pairs.map((pair) => {
    const left = seat(pair.left_id, answers, sql);
    const right = pair.right_id ? seat(pair.right_id, answers, sql) : null;
    const awards = scored
      ? resolvePair({
          left,
          right,
          target: question.target,
          within: question.within,
          points: question.points,
        })
      : [];
    return {
      left: nicknameOf(sql, pair.left_id) ?? "Player",
      right: pair.right_id ? nicknameOf(sql, pair.right_id) : null,
      leftValue: scored ? left.value : null,
      rightValue: scored && right ? right.value : null,
      result: resultLabel(awards, left.playerId, right?.playerId ?? null),
    };
  });
  const own = selfPlayerId
    ? answers.find(
        (answer) => answer.player_id === selfPlayerId && !isRevoked(sql, selfPlayerId),
      )
    : undefined;
  const ownPrediction = selfPlayerId
    ? predictions.find((prediction) => prediction.player_id === selfPlayerId)
    : undefined;
  const showBackers = scored && publicBackers(question.attribution, room.phase);
  const index = room.questionIndex + 1;
  const questionView =
    question.kind === "duel"
      ? {
          kind: "duel" as const,
          id: question.id,
          index,
          total: room.questionCount,
          prompt: question.prompt,
          points: question.points,
          illustrative: true as const,
          attribution: question.attribution,
          minimum: question.minimum,
          maximum: question.maximum,
          step: question.step,
          target: question.target,
          within: question.within,
          odd: "solo" as const,
          tie: "shared" as const,
          absence: "forfeit" as const,
          lateJoin: "ineligible" as const,
          tieBreak: question.tieBreak,
        }
      : {
          kind: "finale" as const,
          id: question.id,
          index,
          total: room.questionCount,
          prompt: question.prompt,
          points: question.points,
          illustrative: true as const,
          attribution: question.attribution,
          minimum: question.minimum,
          maximum: question.maximum,
          step: question.step,
          target: question.target,
          within: question.within,
          tie: "shared" as const,
          absence: "forfeit" as const,
          lateJoin: "ineligible" as const,
          tieBreak: question.tieBreak,
          contestants: [...question.contestants] as [string, string],
          predictionPoints: question.predictionPoints,
        };
  return {
    question: questionView,
    submissionCount:
      room.phase === "predict" ? predictions.length : countingAnswers(answers, sql),
    selfAnswer:
      own && role !== "late" ? { kind: "duel" as const, value: own.value } : null,
    selfBallot: ownPrediction ? { candidateId: ownPrediction.contestant_id } : null,
    ballot: null,
    duel: {
      role,
      opponentId: opponent?.id ?? null,
      opponent: opponent?.nickname ?? null,
      reason,
      board: audience === "guest" ? null : { total: pairs.length, rows: shown },
      cards,
    },
    reveal: scored
      ? question.kind === "finale"
        ? {
            kind: "finale" as const,
            pairCount: pairs.length,
            pairs: visiblePairs(results, stageCardCap),
            predictionCount: predictions.length,
            backers: showBackers
              ? predictions.slice(0, stageCardCap).flatMap((prediction) => {
                  const nickname = nicknameOf(sql, prediction.player_id);
                  const contestant = nicknameOf(sql, prediction.contestant_id);
                  return nickname && contestant ? [{ nickname, contestant }] : [];
                })
              : null,
          }
        : {
            kind: "duel" as const,
            pairCount: pairs.length,
            pairs: visiblePairs(results, stageCardCap),
          }
      : null,
    liveSample: liveNames(sql, question, room.phase),
    ...(audience === "control"
      ? { hostResponses: hostRows(sql, answers, predictions) }
      : {}),
  };
}

export function wrongKindDuel(): string {
  return duelClosedMessage;
}

function writePairs(
  sql: SqlStorage,
  questionId: string,
  pairs: { leftId: string; rightId: string | null }[],
  players: { player_id: string }[],
  playing: Set<string>,
): void {
  pairs.forEach((pair, pairIndex) => {
    sql.exec(
      `INSERT INTO duel_pair (question_id, pair_index, left_id, right_id) VALUES (?, ?, ?, ?)`,
      questionId,
      pairIndex,
      pair.leftId,
      pair.rightId,
    );
  });
  for (const player of players) {
    sql.exec(
      `INSERT INTO duel_role (question_id, player_id, role) VALUES (?, ?, ?)`,
      questionId,
      player.player_id,
      playing.has(player.player_id) ? "player" : "spectator",
    );
  }
}

function scoreSolo(
  seat: DuelSeat,
  target: number,
  within: number,
  points: number,
): DuelAward {
  if (seat.value === null) {
    return missing(seat.playerId);
  }
  if (Math.abs(seat.value - target) <= within) {
    return win(seat.playerId, points);
  }
  return miss(seat.playerId);
}

function win(playerId: string, points: number): DuelAward {
  return { playerId, points, detail: "win" };
}

function tie(playerId: string, points: number): DuelAward {
  return { playerId, points, detail: "tie" };
}

function miss(playerId: string): DuelAward {
  return { playerId, points: 0, detail: "miss" };
}

function missing(playerId: string): DuelAward {
  return { playerId, points: 0, detail: "missing" };
}

function resultLabel(
  awards: DuelAward[],
  leftId: string,
  rightId: string | null,
): "left" | "right" | "tie" | "solo" | "none" {
  if (awards.length === 0) {
    return "none";
  }
  const left = awards.find((award) => award.playerId === leftId);
  const right = rightId
    ? awards.find((award) => award.playerId === rightId)
    : undefined;
  if (!rightId) {
    return left && left.points > 0 ? "solo" : "none";
  }
  if (left?.detail === "tie") {
    return "tie";
  }
  if ((left?.points ?? 0) > 0) {
    return "left";
  }
  if ((right?.points ?? 0) > 0) {
    return "right";
  }
  return "none";
}

function seat(
  playerId: string,
  answers: { player_id: string; value: number; received_at: number }[],
  sql: SqlStorage,
): DuelSeat {
  if (isRevoked(sql, playerId)) {
    return { playerId, value: null, receivedAt: null };
  }
  const answer = answers.find((item) => item.player_id === playerId);
  return {
    playerId,
    value: answer?.value ?? null,
    receivedAt: answer?.received_at ?? null,
  };
}

function snapshotRole(
  sql: SqlStorage,
  questionId: string,
  playerId: string,
  pairs: { left_id: string; right_id: string | null }[],
): "pair" | "solo" | "spectator" | "late" {
  const role = readRole(sql, questionId, playerId);
  if (!role) {
    return "late";
  }
  if (role === "spectator") {
    return "spectator";
  }
  const pair = pairs.find(
    (item) => item.left_id === playerId || item.right_id === playerId,
  );
  if (pair && pair.right_id === null) {
    return "solo";
  }
  return "pair";
}

function waiting(
  room: RoomClock,
  role: "pair" | "solo" | "spectator" | "late",
): "waiting" | "closed" {
  if (role === "spectator" && room.phase === "collect") {
    return "waiting";
  }
  if ((role === "pair" || role === "solo") && room.phase === "predict") {
    return "waiting";
  }
  return "closed";
}

function opponentOf(
  sql: SqlStorage,
  pairs: { left_id: string; right_id: string | null }[],
  playerId: string,
): { id: string; nickname: string } | null {
  const pair = pairs.find(
    (item) => item.left_id === playerId || item.right_id === playerId,
  );
  if (!pair) {
    return null;
  }
  const other = pair.left_id === playerId ? pair.right_id : pair.left_id;
  if (!other) {
    return null;
  }
  const nickname = nicknameOf(sql, other);
  return nickname ? { id: other, nickname } : null;
}

function checkNumber(
  question: Scale,
  value: unknown,
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: duelInvalidMessage };
  }
  if (value < question.minimum || value > question.maximum) {
    return { ok: false, message: duelInvalidMessage };
  }
  const steps = (value - question.minimum) / question.step;
  if (Math.abs(steps - Math.round(steps)) > stepTolerance) {
    return { ok: false, message: duelStepMessage };
  }
  return { ok: true, value };
}

function assertScale(question: Scale): void {
  const numbers = [
    question.minimum,
    question.maximum,
    question.step,
    question.target,
    question.within,
  ];
  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error("A duel needs a finite scale and target.");
  }
  if (question.maximum <= question.minimum) {
    throw new Error("A duel scale has to be wider than zero.");
  }
  if (question.step <= 0) {
    throw new Error("A duel step has to be greater than zero.");
  }
  if (!lands(question, question.minimum) || !lands(question, question.maximum)) {
    throw new Error("A duel step has to land on both ends of the scale.");
  }
  if (
    question.target < question.minimum ||
    question.target > question.maximum ||
    !lands(question, question.target)
  ) {
    throw new Error("A duel target has to sit on the scale.");
  }
  if (question.within < 0) {
    throw new Error("A solo target window cannot be negative.");
  }
  if (
    !Number.isInteger(question.points) ||
    question.points < 1 ||
    question.points > 1000
  ) {
    throw new Error("Duel points stay inside that question's own range.");
  }
}

function lands(question: Scale, value: number): boolean {
  const steps = (value - question.minimum) / question.step;
  return Math.abs(steps - Math.round(steps)) <= stepTolerance;
}

function pointTotals(sql: SqlStorage): number[] {
  return sql
    .exec<{ points: number }>(
      `SELECT
         COALESCE((SELECT SUM(points) FROM score_ledger WHERE player_id = player.player_id), 0)
         + COALESCE((SELECT SUM(points) FROM score_adjustment WHERE player_id = player.player_id), 0)
         AS points
       FROM player
       WHERE revoked_at IS NULL`,
    )
    .toArray()
    .map((row) => row.points);
}

function frozen(sql: SqlStorage, questionId: string): boolean {
  return (
    sql
      .exec(`SELECT question_id FROM duel_freeze WHERE question_id = ?`, questionId)
      .toArray().length > 0
  );
}

function readPairs(sql: SqlStorage, questionId: string) {
  return sql
    .exec<{ left_id: string; right_id: string | null }>(
      `SELECT left_id, right_id FROM duel_pair WHERE question_id = ? ORDER BY pair_index ASC`,
      questionId,
    )
    .toArray();
}

function readAnswers(sql: SqlStorage, questionId: string) {
  return sql
    .exec<{ player_id: string; value: number; received_at: number }>(
      `SELECT player_id, value, received_at FROM duel_answer WHERE question_id = ?`,
      questionId,
    )
    .toArray();
}

function readPredictions(sql: SqlStorage, questionId: string) {
  return sql
    .exec<{ player_id: string; contestant_id: string }>(
      `SELECT player_id, contestant_id FROM duel_prediction
       WHERE question_id = ? ORDER BY received_at ASC`,
      questionId,
    )
    .toArray();
}

function readRole(
  sql: SqlStorage,
  questionId: string,
  playerId: string,
): string | undefined {
  const row = sql
    .exec<{ role: string }>(
      `SELECT role FROM duel_role WHERE question_id = ? AND player_id = ?`,
      questionId,
      playerId,
    )
    .toArray()[0];
  return row?.role;
}

function readRoles(sql: SqlStorage, questionId: string, role: string): string[] {
  return sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM duel_role WHERE question_id = ? AND role = ? ORDER BY rowid ASC`,
      questionId,
      role,
    )
    .toArray()
    .map((row) => row.player_id);
}

function countingAnswers(answers: { player_id: string }[], sql: SqlStorage): number {
  return answers.filter((answer) => !isRevoked(sql, answer.player_id)).length;
}

function hostRows(
  sql: SqlStorage,
  answers: { player_id: string; value: number }[],
  predictions: { player_id: string; contestant_id: string }[],
) {
  const rows = [
    ...answers.map((answer) => ({
      playerId: answer.player_id,
      nickname: nicknameOf(sql, answer.player_id) ?? "Player",
      summary: String(answer.value),
    })),
    ...predictions.map((prediction) => ({
      playerId: prediction.player_id,
      nickname: nicknameOf(sql, prediction.player_id) ?? "Player",
      summary: `backed ${nicknameOf(sql, prediction.contestant_id) ?? "a contestant"}`,
    })),
  ];
  return rows.filter((row) => row.nickname.length > 0).slice(0, 80);
}

function liveNames(
  sql: SqlStorage,
  question: DuelQuestion | FinaleQuestion,
  phase: RoomPhase,
): string[] | null {
  if (question.attribution !== "live") {
    return null;
  }
  if (phase === "predict") {
    return sample(
      sql,
      `SELECT player.nickname FROM duel_prediction
       JOIN player ON player.player_id = duel_prediction.player_id
       WHERE duel_prediction.question_id = ? AND player.revoked_at IS NULL
       ORDER BY duel_prediction.received_at DESC LIMIT ?`,
      question.id,
    );
  }
  if (phase === "collect") {
    return sample(
      sql,
      `SELECT player.nickname FROM duel_answer
       JOIN player ON player.player_id = duel_answer.player_id
       WHERE duel_answer.question_id = ? AND player.revoked_at IS NULL
       ORDER BY duel_answer.received_at DESC LIMIT ?`,
      question.id,
    );
  }
  return null;
}

function sample(sql: SqlStorage, statement: string, questionId: string): string[] {
  return sql
    .exec<{ nickname: string }>(statement, questionId, stageCardCap)
    .toArray()
    .map((row) => row.nickname)
    .reverse();
}

function publicBackers(attribution: AttributionMode, phase: RoomPhase): boolean {
  if (attribution === "never") {
    return false;
  }
  if (attribution === "live") {
    return (
      phase === "predict" ||
      phase === "collect" ||
      phase === "reveal" ||
      phase === "scores" ||
      phase === "final" ||
      phase === "podium"
    );
  }
  return (
    phase === "reveal" || phase === "scores" || phase === "final" || phase === "podium"
  );
}

function activePlayers(sql: SqlStorage) {
  return sql
    .exec<{ player_id: string; nickname: string }>(
      `SELECT player_id, nickname FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray();
}

function nicknameOf(sql: SqlStorage, playerId: string | null): string | null {
  if (!playerId) {
    return null;
  }
  const row = sql
    .exec<{ nickname: string }>(
      `SELECT nickname FROM player WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  return row?.nickname ?? null;
}

function isRevoked(sql: SqlStorage, playerId: string | null): boolean {
  if (!playerId) {
    return false;
  }
  const row = sql
    .exec<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM player WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  return !row || row.revoked_at !== null;
}

function phaseDeadline(
  store: GameStore,
  phaseGeneration: number,
  phase: RoomPhase,
): number | undefined {
  const due = store
    .jobs()
    .find(
      (job) =>
        job.jobType === "gameplay" &&
        job.status === "pending" &&
        job.phase === phase &&
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

for (const question of demoQuestions) {
  if (question.kind === "duel" || question.kind === "finale") {
    assertDuelQuestion(question);
  }
}
