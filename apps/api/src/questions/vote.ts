import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerHeldMessage,
  answerLateMessage,
  answerPausedMessage,
  ballotClosedMessage,
  ballotLateJoinMessage,
  ballotSelfMessage,
  ballotUnknownMessage,
  ballotWithdrawnMessage,
  featureClosedMessage,
  featureLimitMessage,
  shortlistClosedMessage,
  shortlistMissingMessage,
  textClosedMessage,
  textInvalidMessage,
} from "../room/limits.ts";
import {
  submissionGate,
  type GameStore,
  type RoomClock,
  type RoomPhase,
  type RoundPhase,
} from "../room/lifecycle.ts";
import {
  assertCollectWindow,
  type AttributionMode,
  type GuessQuestion,
  type Question,
  type VoteQuestion,
} from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { playableQuestions, questionFor, questionPacks } from "./registry.ts";

export const stageCardCap = 8;

export function cardsForAudience<T>(
  audience: "guest" | "stage" | "control",
  cards: readonly T[],
): T[] {
  return audience === "stage" && cards.length > stageCardCap ? [] : [...cards];
}

type CandidateRow = {
  candidate_id: string;
  owner_id: string | null;
  label: string;
  eligible: number;
  included: number;
  position: number;
};

type BallotAwardMode = "authors" | "voters" | "none";
type WinnerRule = "tally" | "named" | "majority";

export function phasesForQuestion(question: Question): RoundPhase[] {
  const phases: RoundPhase[] = ["intro", "prompt"];
  if (question.kind === "finale") {
    phases.push("predict");
  }
  phases.push("collect");
  if (question.kind === "vote") {
    phases.push("vote");
  }
  phases.push("reveal", "scores");
  return phases;
}

export function applyQuestionClock(store: GameStore): void {
  const room = store.readRoom();
  if (room.questionCount <= 0) {
    return;
  }
  const question = questionFor(room);
  if (!question) {
    return;
  }
  const phases = phasesForQuestion(question);
  const durations = { ...room.durations };
  if (question.kind === "vote") {
    durations.vote = question.voteMs;
  }
  if (question.kind === "finale") {
    durations.predict = question.predictMs;
  }
  if (
    phases.join() === room.phases.join() &&
    durations.vote === room.durations.vote &&
    durations.predict === room.durations.predict
  ) {
    return;
  }
  store.writeRoom({ ...room, phases, durations });
}

export function assertVoteQuestion(question: VoteQuestion): void {
  assertCollectWindow(question.voteMs);
  if (question.votes !== 1) {
    throw new Error("This question accepts one vote.");
  }
  if (question.tie !== "shared") {
    throw new Error("Tied winners each receive this question's points.");
  }
  if (question.lateJoin !== "ineligible") {
    throw new Error("A player who joins after the ballot freezes cannot vote.");
  }
  if (question.selfVote !== "forbidden" && question.selfVote !== "allowed") {
    throw new Error("Say whether players may vote for themselves.");
  }
  if (question.candidateMode !== "all" && question.candidateMode !== "shortlist") {
    throw new Error("Say whether the ballot is every answer or a host shortlist.");
  }
  if (question.award !== "authors" && question.award !== "voters") {
    throw new Error("Say whether the writers or the voters receive the points.");
  }
}

export function assertGuessQuestion(question: GuessQuestion): void {
  if (question.tie !== "shared") {
    throw new Error("Tied winners each receive this question's points.");
  }
  if (question.lateJoin !== "ineligible") {
    throw new Error("A player who joins after the ballot freezes cannot vote.");
  }
  if (question.roster === "room" && question.shortlist.length > 0) {
    throw new Error("A whole-room guess does not also carry a shortlist.");
  }
  if (question.roster === "shortlist" && question.shortlist.length < 2) {
    throw new Error("A guess shortlist needs at least two names.");
  }
  if (question.scoring === "named" && !question.truthNickname) {
    throw new Error("A named guess needs a server-only answer.");
  }
  if (question.scoring !== "named" && question.truthNickname) {
    throw new Error("Only a named guess carries a server-only answer.");
  }
  const names = new Set(question.shortlist.map((name) => name.toLowerCase()));
  if (names.size !== question.shortlist.length) {
    throw new Error("A guess shortlist cannot repeat a name.");
  }
}

export function winningIds(input: {
  scoring: WinnerRule;
  candidates: readonly { id: string; eligible: boolean; included: boolean }[];
  ballots: readonly { candidateId: string }[];
  truthId: string | null;
}): string[] {
  const live = input.candidates.filter(
    (candidate) => candidate.eligible && candidate.included,
  );
  const liveIds = new Set(live.map((candidate) => candidate.id));
  if (input.scoring === "named") {
    return input.truthId && liveIds.has(input.truthId) ? [input.truthId] : [];
  }
  const counts = new Map<string, number>();
  for (const id of liveIds) {
    counts.set(id, 0);
  }
  for (const ballot of input.ballots) {
    if (!liveIds.has(ballot.candidateId)) {
      continue;
    }
    counts.set(ballot.candidateId, (counts.get(ballot.candidateId) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) {
    if (count > best) {
      best = count;
    }
  }
  if (best === 0) {
    return [];
  }
  return [...counts].filter(([, count]) => count === best).map(([id]) => id);
}

/**
 * Each tied winner receives the question's own points. The award is not split
 * and is not given to only one of the tied candidates. Featured stage cards
 * are not an input: they do not change who wins.
 */
export function awardsForBallot(input: {
  points: number;
  mode: BallotAwardMode;
  winners: readonly string[];
  candidates: readonly { id: string; ownerId: string | null }[];
  ballots: readonly { playerId: string; candidateId: string }[];
  playerIds: readonly string[];
}): { playerId: string; points: number; detail: string }[] {
  const winnerSet = new Set(input.winners);
  return input.playerIds.map((playerId) => {
    if (input.mode === "none" || winnerSet.size === 0) {
      return {
        playerId,
        points: 0,
        detail: input.mode === "none" ? "unscored" : "missing",
      };
    }
    const won =
      input.mode === "authors"
        ? input.candidates.some(
            (candidate) =>
              candidate.ownerId === playerId && winnerSet.has(candidate.id),
          )
        : winnerSet.has(
            input.ballots.find((ballot) => ballot.playerId === playerId)?.candidateId ??
              "",
          );
    if (
      !won &&
      input.mode === "voters" &&
      !input.ballots.some((ballot) => ballot.playerId === playerId)
    ) {
      return { playerId, points: 0, detail: "missing" };
    }
    return {
      playerId,
      points: won ? input.points : 0,
      detail: won ? (winnerSet.size > 1 ? "tie" : "win") : "miss",
    };
  });
}

export function revealSelection(
  cards: readonly { id: string; votes: number; position: number }[],
  featuredIds: readonly string[],
  cap: number,
): string[] {
  const known = new Set(cards.map((card) => card.id));
  const featured = featuredIds.filter((id) => known.has(id));
  if (featured.length > 0) {
    return featured.slice(0, cap);
  }
  return [...cards]
    .sort((left, right) => right.votes - left.votes || left.position - right.position)
    .slice(0, cap)
    .map((card) => card.id);
}

export function shuffleIds(
  ids: readonly string[],
  seed: string,
  playerId: string,
): string[] {
  const next = [...ids];
  const random = mulberry32(hashString(`${seed}:${playerId}`));
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = next[index] ?? "";
    next[index] = next[swap] ?? current;
    next[swap] = current;
  }
  return next;
}

export function acceptText(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: VoteQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  const room = store.readRoom();
  if (room.phase !== "collect") {
    return { ok: false, message: answerClosedMessage };
  }
  if (typeof value !== "string") {
    return { ok: false, message: textInvalidMessage };
  }
  const body = value.trim();
  if (body.length < 1 || body.length > 80 || hasControlCharacter(body)) {
    return { ok: false, message: textInvalidMessage };
  }
  const existing = sql
    .exec(
      `SELECT player_id FROM text_response WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (existing) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const deadline = phaseDeadline(store, room.phaseGeneration, "collect");
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO text_response (
       player_id, question_id, body, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    body,
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function acceptBallot(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: VoteQuestion | GuessQuestion,
): { ok: true } | { ok: false; message: string } {
  const room = store.readRoom();
  const openPhase = question.kind === "vote" ? "vote" : "collect";
  if (room.phase !== openPhase) {
    return { ok: false, message: ballotClosedMessage };
  }
  const gate = gateMessage(store, now);
  if (gate) {
    return { ok: false, message: gate };
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,36}$/.test(value)) {
    return { ok: false, message: ballotUnknownMessage };
  }
  const elector = sql
    .exec(
      `SELECT player_id FROM vote_elector WHERE question_id = ? AND player_id = ?`,
      question.id,
      playerId,
    )
    .toArray()[0];
  if (!elector) {
    return { ok: false, message: ballotLateJoinMessage };
  }
  const existing = sql
    .exec(
      `SELECT candidate_id FROM vote_ballot WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (existing) {
    return { ok: false, message: answerDuplicateMessage };
  }
  const candidate = readCandidate(sql, question.id, value);
  if (!candidate || candidate.included !== 1) {
    return { ok: false, message: ballotUnknownMessage };
  }
  if (candidate.eligible !== 1 || isRevoked(sql, candidate.owner_id)) {
    return { ok: false, message: ballotWithdrawnMessage };
  }
  if (question.selfVote === "forbidden" && candidate.owner_id === playerId) {
    return { ok: false, message: ballotSelfMessage };
  }
  const deadline = phaseDeadline(store, room.phaseGeneration, openPhase);
  if (deadline === undefined) {
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO vote_ballot (
       player_id, question_id, candidate_id, received_at, deadline_at, device_context_id
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

export function includeAuthor(sql: SqlStorage, playerId: string): void {
  const question = currentVote(sql);
  if (!question || question.candidateMode !== "shortlist") {
    throw new Error(shortlistClosedMessage);
  }
  const room = readPhase(sql);
  if (room !== "collect" || frozen(sql, question.id)) {
    throw new Error(shortlistClosedMessage);
  }
  const answer = sql
    .exec(
      `SELECT player_id FROM text_response WHERE player_id = ? AND question_id = ?`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (!answer) {
    throw new Error(shortlistMissingMessage);
  }
  sql.exec(
    `INSERT OR IGNORE INTO vote_shortlist (question_id, player_id) VALUES (?, ?)`,
    question.id,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function excludeAuthor(sql: SqlStorage, playerId: string): void {
  const question = currentVote(sql);
  if (!question || question.candidateMode !== "shortlist") {
    throw new Error(shortlistClosedMessage);
  }
  if (readPhase(sql) !== "collect" || frozen(sql, question.id)) {
    throw new Error(shortlistClosedMessage);
  }
  sql.exec(
    `DELETE FROM vote_shortlist WHERE question_id = ? AND player_id = ?`,
    question.id,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function featureCandidate(sql: SqlStorage, candidateId: string): void {
  const question = currentBallotQuestion(sql);
  const phase = readPhase(sql);
  if (!question || (phase !== "vote" && phase !== "reveal" && phase !== "scores")) {
    throw new Error(featureClosedMessage);
  }
  const candidate = readCandidate(sql, question.id, candidateId);
  if (!candidate || candidate.included !== 1) {
    throw new Error(ballotUnknownMessage);
  }
  const count = sql
    .exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM vote_feature WHERE question_id = ?`,
      question.id,
    )
    .toArray()[0];
  const already = sql
    .exec(
      `SELECT candidate_id FROM vote_feature WHERE question_id = ? AND candidate_id = ?`,
      question.id,
      candidateId,
    )
    .toArray()[0];
  if (!already && (count?.total ?? 0) >= stageCardCap) {
    throw new Error(featureLimitMessage);
  }
  const position = count?.total ?? 0;
  sql.exec(
    `INSERT OR IGNORE INTO vote_feature (question_id, candidate_id, position) VALUES (?, ?, ?)`,
    question.id,
    candidateId,
    position,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function freezeVote(sql: SqlStorage, question: VoteQuestion, now: number): void {
  if (frozen(sql, question.id)) {
    return;
  }
  const seed = crypto.randomUUID();
  const shortlist = new Set(
    sql
      .exec<{ player_id: string }>(
        `SELECT player_id FROM vote_shortlist WHERE question_id = ?`,
        question.id,
      )
      .toArray()
      .map((row) => row.player_id),
  );
  const answers = sql
    .exec<{ player_id: string; body: string }>(
      `SELECT text_response.player_id, text_response.body
       FROM text_response
       JOIN player ON player.player_id = text_response.player_id
       WHERE text_response.question_id = ?
       ORDER BY text_response.received_at ASC, player.rowid ASC`,
      question.id,
    )
    .toArray();
  answers.forEach((answer, position) => {
    const eligible = isRevoked(sql, answer.player_id) ? 0 : 1;
    const included =
      question.candidateMode === "all" || shortlist.has(answer.player_id) ? 1 : 0;
    sql.exec(
      `INSERT INTO vote_candidate (
         question_id, candidate_id, owner_id, label, eligible, included, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      question.id,
      newCandidateId(),
      answer.player_id,
      answer.body,
      eligible,
      included,
      position,
    );
  });
  freezeElectors(sql, question.id, seed, null, now);
}

export function freezeGuess(
  sql: SqlStorage,
  question: GuessQuestion,
  now: number,
): void {
  if (frozen(sql, question.id)) {
    return;
  }
  const seed = crypto.randomUUID();
  const players = activePlayers(sql);
  let truthId: string | null = null;
  if (question.roster === "room") {
    players.forEach((player, position) => {
      sql.exec(
        `INSERT INTO vote_candidate (
           question_id, candidate_id, owner_id, label, eligible, included, position
         ) VALUES (?, ?, ?, ?, 1, 1, ?)`,
        question.id,
        player.player_id,
        player.player_id,
        player.nickname,
        position,
      );
      if (
        question.truthNickname &&
        player.nickname.toLowerCase() === question.truthNickname.toLowerCase()
      ) {
        truthId = player.player_id;
      }
    });
  } else {
    question.shortlist.forEach((name, position) => {
      const player = players.find(
        (item) => item.nickname.toLowerCase() === name.toLowerCase(),
      );
      const id = player?.player_id ?? `absent-${position}`;
      sql.exec(
        `INSERT INTO vote_candidate (
           question_id, candidate_id, owner_id, label, eligible, included, position
         ) VALUES (?, ?, ?, ?, ?, 1, ?)`,
        question.id,
        id,
        player?.player_id ?? null,
        player?.nickname ?? name,
        player ? 1 : 0,
        position,
      );
      if (
        question.truthNickname &&
        name.toLowerCase() === question.truthNickname.toLowerCase()
      ) {
        truthId = player?.player_id ?? null;
      }
    });
  }
  freezeElectors(
    sql,
    question.id,
    seed,
    question.scoring === "named" ? truthId : null,
    now,
  );
}

export function scoreBallotQuestion(
  sql: SqlStorage,
  question: VoteQuestion | GuessQuestion,
  now: number,
): void {
  const candidates = readCandidates(sql, question.id);
  const ballots = readBallots(sql, question.id);
  const truthId = readTruth(sql, question.id);
  const winners = winningIds({
    scoring: question.kind === "guess" ? guessRule(question) : "tally",
    candidates: candidates.map((candidate) => ({
      id: candidate.candidate_id,
      eligible: candidate.eligible === 1 && !isRevoked(sql, candidate.owner_id),
      included: candidate.included === 1,
    })),
    ballots: ballots.map((ballot) => ({ candidateId: ballot.candidate_id })),
    truthId,
  });
  const players = activePlayers(sql).map((player) => player.player_id);
  const awards = awardsForBallot({
    points: question.points,
    mode:
      question.kind === "vote"
        ? question.award
        : question.scoring === "none"
          ? "none"
          : "voters",
    winners,
    candidates: candidates.map((candidate) => ({
      id: candidate.candidate_id,
      ownerId: candidate.owner_id,
    })),
    ballots: ballots.map((ballot) => ({
      playerId: ballot.player_id,
      candidateId: ballot.candidate_id,
    })),
    playerIds: players,
  });
  for (const award of awards) {
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

export function ballotPlayFields(
  sql: SqlStorage,
  question: VoteQuestion | GuessQuestion,
  room: RoomClock,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  scored: boolean,
) {
  const candidates = readCandidates(sql, question.id);
  const included = candidates.filter((candidate) => candidate.included === 1);
  const ballots = readBallots(sql, question.id);
  const counts = new Map<string, number>();
  for (const ballot of ballots) {
    const target = candidates.find((item) => item.candidate_id === ballot.candidate_id);
    if (
      !target ||
      target.included !== 1 ||
      target.eligible !== 1 ||
      isRevoked(sql, target.owner_id)
    ) {
      continue;
    }
    counts.set(ballot.candidate_id, (counts.get(ballot.candidate_id) ?? 0) + 1);
  }
  const order = cardOrder(sql, question.id, selfPlayerId, included);
  const showAuthor = publicAuthor(question.attribution, room.phase, scored);
  const elector = selfPlayerId
    ? sql
        .exec(
          `SELECT player_id FROM vote_elector WHERE question_id = ? AND player_id = ?`,
          question.id,
          selfPlayerId,
        )
        .toArray()[0]
    : undefined;
  const votingPhase =
    question.kind === "vote" ? room.phase === "vote" : room.phase === "collect";
  const reason = !votingPhase
    ? "closed"
    : audience === "guest" && !elector && included.length > 0
      ? "late"
      : included.length === 0
        ? "empty"
        : "open";
  const cards = cardsForAudience(audience, order).map((candidate) => ({
    id: candidate.candidate_id,
    label: candidate.label,
    own: audience === "guest" && candidate.owner_id === selfPlayerId,
    selectable:
      audience === "guest" &&
      reason === "open" &&
      candidate.eligible === 1 &&
      !isRevoked(sql, candidate.owner_id) &&
      (question.selfVote === "allowed" || candidate.owner_id !== selfPlayerId),
    author:
      question.kind === "vote" && showAuthor
        ? nicknameOf(sql, candidate.owner_id)
        : null,
  }));
  const text =
    question.kind === "vote" && selfPlayerId
      ? sql
          .exec<{ body: string }>(
            `SELECT body FROM text_response WHERE player_id = ? AND question_id = ?`,
            selfPlayerId,
            question.id,
          )
          .toArray()[0]
      : undefined;
  const ownBallot = selfPlayerId
    ? ballots.find((ballot) => ballot.player_id === selfPlayerId)
    : undefined;
  const featured = featuredIds(sql, question.id);
  const revealIds = scored
    ? revealSelection(
        included.map((candidate) => ({
          id: candidate.candidate_id,
          votes: counts.get(candidate.candidate_id) ?? 0,
          position: candidate.position,
        })),
        featured,
        stageCardCap,
      )
    : [];
  const truthId = readTruth(sql, question.id);
  const winners = scored
    ? winningIds({
        scoring: question.kind === "guess" ? guessRule(question) : "tally",
        candidates: candidates.map((candidate) => ({
          id: candidate.candidate_id,
          eligible: candidate.eligible === 1 && !isRevoked(sql, candidate.owner_id),
          included: candidate.included === 1,
        })),
        ballots: ballots.map((ballot) => ({ candidateId: ballot.candidate_id })),
        truthId,
      })
    : [];
  const revealCards = revealIds.flatMap((id) => {
    const candidate = candidates.find((item) => item.candidate_id === id);
    if (!candidate) {
      return [];
    }
    return [
      {
        id: candidate.candidate_id,
        label: candidate.label,
        votes: counts.get(candidate.candidate_id) ?? 0,
        winning: winners.includes(candidate.candidate_id),
        author: showAuthor ? nicknameOf(sql, candidate.owner_id) : null,
        voters: showAuthor ? voterNames(sql, ballots, candidate.candidate_id) : null,
      },
    ];
  });
  const winnerCards = winners.slice(0, stageCardCap).flatMap((id) => {
    const candidate = candidates.find((item) => item.candidate_id === id);
    return candidate ? [{ id: candidate.candidate_id, label: candidate.label }] : [];
  });
  const index = room.questionIndex + 1;
  const questionView =
    question.kind === "vote"
      ? {
          ...publicQuestionCore(question, index, room.questionCount),
          kind: "vote" as const,
          candidateMode: question.candidateMode,
          selfVote: question.selfVote,
          votes: 1 as const,
          tie: "shared" as const,
          award: question.award,
          lateJoin: "ineligible" as const,
        }
      : {
          ...publicQuestionCore(question, index, room.questionCount),
          kind: "guess" as const,
          roster: question.roster,
          selfVote: question.selfVote,
          tie: "shared" as const,
          scoring: question.scoring,
          lateJoin: "ineligible" as const,
          search: true as const,
        };
  const submissionCount =
    question.kind === "vote" && room.phase === "collect"
      ? textCount(sql, question.id)
      : ballots.length;
  return {
    question: questionView,
    submissionCount,
    selfAnswer: text ? { kind: "text" as const, body: text.body } : null,
    selfBallot: ownBallot ? { candidateId: ownBallot.candidate_id } : null,
    ballot: {
      total: included.length,
      reason,
      cards,
    },
    reveal: scored
      ? question.kind === "vote"
        ? {
            kind: "vote" as const,
            totalBallots: ballots.length,
            featured: featured.length > 0,
            winnerCount: winners.length,
            winners: winnerCards,
            cards: revealCards,
          }
        : {
            kind: "guess" as const,
            totalBallots: ballots.length,
            featured: featured.length > 0,
            winnerCount: winners.length,
            winners: winnerCards,
            truthLabel:
              question.scoring === "named"
                ? (candidates.find((candidate) => candidate.candidate_id === truthId)
                    ?.label ?? null)
                : null,
            cards: revealCards,
          }
      : null,
    liveSample: ballotNames(sql, question, room.phase),
    ...(audience === "control"
      ? { hostResponses: hostRows(sql, question, candidates, ballots, counts) }
      : {}),
  };
}

export function wrongKindText(): string {
  return textClosedMessage;
}

export function wrongKindBallot(): string {
  return ballotClosedMessage;
}

function freezeElectors(
  sql: SqlStorage,
  questionId: string,
  seed: string,
  truthId: string | null,
  now: number,
): void {
  const players = activePlayers(sql);
  for (const player of players) {
    sql.exec(
      `INSERT INTO vote_elector (question_id, player_id) VALUES (?, ?)`,
      questionId,
      player.player_id,
    );
  }
  const included = readCandidates(sql, questionId).filter(
    (candidate) => candidate.included === 1,
  );
  const ids = included.map((candidate) => candidate.candidate_id);
  for (const player of players) {
    sql.exec(
      `INSERT INTO vote_order (player_id, question_id, order_json) VALUES (?, ?, ?)`,
      player.player_id,
      questionId,
      JSON.stringify(shuffleIds(ids, seed, player.player_id)),
    );
  }
  sql.exec(
    `INSERT INTO vote_freeze (question_id, seed, truth_id, frozen_at) VALUES (?, ?, ?, ?)`,
    questionId,
    seed,
    truthId,
    now,
  );
}

function cardOrder(
  sql: SqlStorage,
  questionId: string,
  selfPlayerId: string | undefined,
  included: CandidateRow[],
): CandidateRow[] {
  const stored = selfPlayerId
    ? sql
        .exec<{ order_json: string }>(
          `SELECT order_json FROM vote_order WHERE player_id = ? AND question_id = ?`,
          selfPlayerId,
          questionId,
        )
        .toArray()[0]
    : undefined;
  const byId = new Map(
    included.map((candidate) => [candidate.candidate_id, candidate]),
  );
  if (!stored) {
    return included;
  }
  let ids: unknown;
  try {
    ids = JSON.parse(stored.order_json) as unknown;
  } catch {
    return included;
  }
  if (!Array.isArray(ids)) {
    return included;
  }
  const ordered = ids.flatMap((id) => {
    const candidate = typeof id === "string" ? byId.get(id) : undefined;
    return candidate ? [candidate] : [];
  });
  const seen = new Set(ordered.map((candidate) => candidate.candidate_id));
  return [
    ...ordered,
    ...included.filter((candidate) => !seen.has(candidate.candidate_id)),
  ];
}

function hostRows(
  sql: SqlStorage,
  question: VoteQuestion | GuessQuestion,
  candidates: CandidateRow[],
  ballots: { player_id: string; candidate_id: string }[],
  counts: Map<string, number>,
) {
  if (question.kind === "guess" && ballots.length > 0) {
    return ballots.slice(0, 80).flatMap((ballot) => {
      const candidate = candidates.find(
        (item) => item.candidate_id === ballot.candidate_id,
      );
      const nickname = nicknameOf(sql, ballot.player_id);
      if (!nickname || !candidate) {
        return [];
      }
      return [
        {
          playerId: ballot.player_id,
          nickname,
          summary: `voted for ${candidate.label}`.slice(0, 200),
          candidateId: ballot.candidate_id,
        },
      ];
    });
  }
  if (question.kind === "vote") {
    return sql
      .exec<{ player_id: string; nickname: string; body: string }>(
        `SELECT text_response.player_id, player.nickname, text_response.body
         FROM text_response
         JOIN player ON player.player_id = text_response.player_id
         WHERE text_response.question_id = ?
         ORDER BY text_response.received_at ASC`,
        question.id,
      )
      .toArray()
      .map((row) => {
        const candidate = candidates.find((item) => item.owner_id === row.player_id);
        const votes = candidate ? (counts.get(candidate.candidate_id) ?? 0) : 0;
        return {
          playerId: row.player_id,
          nickname: row.nickname,
          summary: row.body,
          ...(candidate ? { candidateId: candidate.candidate_id, votes } : {}),
          included: candidate
            ? candidate.included === 1
            : shortlisted(sql, question.id, row.player_id),
        };
      });
  }
  return candidates.slice(0, 80).flatMap((candidate) => {
    const nickname = nicknameOf(sql, candidate.owner_id);
    if (!nickname || !candidate.owner_id) {
      return [];
    }
    return [
      {
        playerId: candidate.owner_id,
        nickname,
        summary: candidate.label,
        candidateId: candidate.candidate_id,
        votes: counts.get(candidate.candidate_id) ?? 0,
        included: true,
      },
    ];
  });
}

function voterNames(
  sql: SqlStorage,
  ballots: { player_id: string; candidate_id: string }[],
  candidateId: string,
): string[] {
  return ballots
    .filter((ballot) => ballot.candidate_id === candidateId)
    .slice(0, stageCardCap)
    .flatMap((ballot) => {
      const nickname = nicknameOf(sql, ballot.player_id);
      return nickname ? [nickname] : [];
    });
}

function ballotNames(
  sql: SqlStorage,
  question: VoteQuestion | GuessQuestion,
  phase: RoomPhase,
): string[] | null {
  if (question.attribution !== "live") {
    return null;
  }
  if (question.kind === "vote" && phase === "collect") {
    return sampleNames(
      sql,
      `SELECT player.nickname FROM text_response
       JOIN player ON player.player_id = text_response.player_id
       WHERE text_response.question_id = ? AND player.revoked_at IS NULL
       ORDER BY text_response.received_at DESC LIMIT ?`,
      question.id,
    );
  }
  if (phase === "vote" || (question.kind === "guess" && phase === "collect")) {
    return sampleNames(
      sql,
      `SELECT player.nickname FROM vote_ballot
       JOIN player ON player.player_id = vote_ballot.player_id
       WHERE vote_ballot.question_id = ? AND player.revoked_at IS NULL
       ORDER BY vote_ballot.received_at DESC LIMIT ?`,
      question.id,
    );
  }
  return null;
}

function sampleNames(sql: SqlStorage, statement: string, questionId: string): string[] {
  return sql
    .exec<{ nickname: string }>(statement, questionId, stageCardCap)
    .toArray()
    .map((row) => row.nickname)
    .reverse();
}

function publicAuthor(
  attribution: AttributionMode,
  phase: RoomPhase,
  scored: boolean,
): boolean {
  if (attribution === "never") {
    return false;
  }
  if (attribution === "live") {
    return phase === "collect" || phase === "vote" || scored;
  }
  return scored;
}

function guessRule(question: GuessQuestion): WinnerRule {
  if (question.scoring === "majority") {
    return "majority";
  }
  return "named";
}

function textCount(sql: SqlStorage, questionId: string): number {
  const row = sql
    .exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM text_response WHERE question_id = ?`,
      questionId,
    )
    .toArray()[0];
  return row?.total ?? 0;
}

function readCandidates(sql: SqlStorage, questionId: string): CandidateRow[] {
  return sql
    .exec<CandidateRow>(
      `SELECT candidate_id, owner_id, label, eligible, included, position
       FROM vote_candidate WHERE question_id = ? ORDER BY position ASC`,
      questionId,
    )
    .toArray();
}

function readCandidate(
  sql: SqlStorage,
  questionId: string,
  candidateId: string,
): CandidateRow | undefined {
  return readCandidates(sql, questionId).find(
    (candidate) => candidate.candidate_id === candidateId,
  );
}

function readBallots(sql: SqlStorage, questionId: string) {
  return sql
    .exec<{ player_id: string; candidate_id: string }>(
      `SELECT player_id, candidate_id FROM vote_ballot
       WHERE question_id = ? ORDER BY received_at ASC`,
      questionId,
    )
    .toArray();
}

function readTruth(sql: SqlStorage, questionId: string): string | null {
  const row = sql
    .exec<{ truth_id: string | null }>(
      `SELECT truth_id FROM vote_freeze WHERE question_id = ?`,
      questionId,
    )
    .toArray()[0];
  return row?.truth_id ?? null;
}

function featuredIds(sql: SqlStorage, questionId: string): string[] {
  return sql
    .exec<{ candidate_id: string }>(
      `SELECT candidate_id FROM vote_feature WHERE question_id = ? ORDER BY position ASC`,
      questionId,
    )
    .toArray()
    .map((row) => row.candidate_id);
}

function frozen(sql: SqlStorage, questionId: string): boolean {
  return (
    sql
      .exec(`SELECT question_id FROM vote_freeze WHERE question_id = ?`, questionId)
      .toArray().length > 0
  );
}

function shortlisted(sql: SqlStorage, questionId: string, playerId: string): boolean {
  return (
    sql
      .exec(
        `SELECT player_id FROM vote_shortlist WHERE question_id = ? AND player_id = ?`,
        questionId,
        playerId,
      )
      .toArray().length > 0
  );
}

function currentVote(sql: SqlStorage): VoteQuestion | undefined {
  const question = questionFor(readRoomQuestion(sql));
  return question?.kind === "vote" ? question : undefined;
}

function currentBallotQuestion(
  sql: SqlStorage,
): VoteQuestion | GuessQuestion | undefined {
  const question = questionFor(readRoomQuestion(sql));
  if (question?.kind === "vote" || question?.kind === "guess") {
    return question;
  }
  return undefined;
}

function readRoomQuestion(sql: SqlStorage): {
  questionSetVersion: string;
  questionIndex: number;
} {
  const row = sql
    .exec<{ question_index: number; question_set_version: string }>(
      `SELECT question_index, question_set_version FROM room`,
    )
    .toArray()[0];
  return {
    questionIndex: row?.question_index ?? 0,
    questionSetVersion: row?.question_set_version ?? "unreleased",
  };
}

function readPhase(sql: SqlStorage): string {
  const row = sql.exec<{ phase: string }>(`SELECT phase FROM room`).toArray()[0];
  return row?.phase ?? "";
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

function newCandidateId(): string {
  return `c${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
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

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 31) {
      return true;
    }
  }
  return false;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

for (const pack of questionPacks) {
  if (pack.release !== "released") {
    continue;
  }
  for (const question of playableQuestions(pack)) {
    if (question.kind === "vote") {
      assertVoteQuestion(question);
    }
    if (question.kind === "guess") {
      assertGuessQuestion(question);
    }
  }
}
