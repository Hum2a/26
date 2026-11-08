import { reportedScreenGroup } from "@26/shared";
import { resolveContent } from "../questions/registry.ts";
import { createSqlStore } from "../room/sql-store.ts";
import type { Question } from "../questions/definition.ts";
import { trollDefinitions, type TrollKind } from "../troll/catalogue.ts";
import type { StatsAnswer, StatsQuestion, StatsSource } from "./aggregate.ts";

type ReportBits = {
  family: string | null;
  classification: "reported" | "ambiguous" | "unknown" | null;
  screenGroup: "narrower" | "wider" | "unknown" | null;
};

export function readStatsSource(sql: SqlStorage): StatsSource {
  const room = sql
    .exec<{
      game_id: string;
      state_version: number;
      question_set_version: string;
      phase: string;
      created_at: string;
    }>(
      `SELECT game_id, state_version, question_set_version, phase, created_at FROM room`,
    )
    .toArray()[0];
  if (!room) {
    throw new Error("This room does not exist.");
  }
  const openedAt = Date.parse(room.created_at);
  const players = sql
    .exec<{
      player_id: string;
      nickname: string;
      client_class: string;
      joined_at: string | null;
    }>(`SELECT player_id, nickname, client_class, joined_at FROM player`)
    .toArray();
  const contexts = sql
    .exec<{
      context_id: string;
      player_id: string;
      participating: number;
      report_json: string;
      created_at: number;
    }>(
      `SELECT context_id, player_id, participating, report_json, created_at
       FROM device_context ORDER BY created_at ASC`,
    )
    .toArray();
  const byContext = new Map<string, ReportBits>();
  const participating = new Map<string, ReportBits>();
  for (const row of contexts) {
    const bits = readReport(row.report_json);
    byContext.set(row.context_id, bits);
    if (row.participating === 1 && !participating.has(row.player_id)) {
      participating.set(row.player_id, bits);
    }
  }
  const connections = new Map(
    sql
      .exec<{ player_id: string; reconnects: number }>(
        `SELECT player_id, reconnects FROM connection_summary`,
      )
      .toArray()
      .map((row) => [row.player_id, row.reconnects]),
  );
  const choice = sql
    .exec<{
      player_id: string;
      question_id: string;
      option_id: string;
      received_at: number;
      deadline_at: number;
      device_context_id: string | null;
    }>(
      `SELECT player_id, question_id, option_id, received_at, deadline_at, device_context_id
       FROM choice_answer`,
    )
    .toArray();
  const ballots = sql
    .exec<{
      player_id: string;
      question_id: string;
      candidate_id: string;
      received_at: number;
      deadline_at: number;
      device_context_id: string | null;
      label: string | null;
    }>(
      `SELECT vote_ballot.player_id, vote_ballot.question_id, vote_ballot.candidate_id,
              vote_ballot.received_at, vote_ballot.deadline_at, vote_ballot.device_context_id,
              vote_candidate.label
       FROM vote_ballot
       LEFT JOIN vote_candidate
         ON vote_candidate.question_id = vote_ballot.question_id
        AND vote_candidate.candidate_id = vote_ballot.candidate_id
       -- A ballot for an answer the host excluded did not count, and its
       -- text must not reach the public highlights.
       WHERE vote_candidate.included IS NULL OR vote_candidate.included = 1`,
    )
    .toArray();
  const scored = new Map(
    sql
      .exec<{ question_id: string; player_id: string; detail: string }>(
        `SELECT question_id, player_id, detail FROM score_ledger`,
      )
      .toArray()
      .map((row) => [`${row.question_id}:${row.player_id}`, row.detail]),
  );
  const resolved = resolveContent(
    room.question_set_version,
    createSqlStore(sql).readRoom().questionScript,
  );
  const packQuestions = resolved.status === "playable" ? resolved.pack.questions : [];
  const questionsById = new Map(
    packQuestions.map((question) => [question.id, question]),
  );
  const answers: StatsAnswer[] = [
    ...choice.map((row) => {
      const question = questionsById.get(row.question_id);
      const optionLabel =
        question && question.kind === "choice"
          ? (question.options.find((option) => option.id === row.option_id)?.label ??
            row.option_id)
          : row.option_id;
      const correct =
        question?.kind === "choice" && question.correctOptionId === row.option_id;
      const report = row.device_context_id
        ? byContext.get(row.device_context_id)
        : undefined;
      return {
        playerId: row.player_id,
        questionId: row.question_id,
        optionId: row.option_id,
        optionLabel,
        correct,
        remainingMs: Math.max(0, row.deadline_at - row.received_at),
        timed: true,
        family: report?.family ?? null,
        screenGroup: report?.screenGroup ?? null,
      };
    }),
    ...ballots.map((row) => {
      const detail = scored.get(`${row.question_id}:${row.player_id}`) ?? "";
      const report = row.device_context_id
        ? byContext.get(row.device_context_id)
        : undefined;
      return {
        playerId: row.player_id,
        questionId: row.question_id,
        optionId: row.candidate_id,
        optionLabel: row.label ?? row.candidate_id,
        correct: detail === "win" || detail === "tie",
        remainingMs: Math.max(0, row.deadline_at - row.received_at),
        timed: true,
        family: report?.family ?? null,
        screenGroup: report?.screenGroup ?? null,
      };
    }),
  ];
  const questions = questionRows(sql, players, answers, openedAt, packQuestions);
  const ledger = sql
    .exec<{ player_id: string; points: number }>(
      `SELECT player_id, points FROM score_ledger`,
    )
    .toArray();
  const adjustments = sql
    .exec<{ player_id: string; points: number }>(
      `SELECT player_id, points FROM score_adjustment`,
    )
    .toArray();
  const totals = new Map<string, number>();
  for (const row of [...ledger, ...adjustments]) {
    totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + row.points);
  }
  const trolls = sql
    .exec<{
      effect_id: string;
      actor_id: string;
      target_id: string;
      kind: string;
      refunded: number;
    }>(`SELECT effect_id, actor_id, target_id, kind, refunded FROM troll_effect`)
    .toArray();
  const media = sql
    .exec<{ player_id: string; kind: string }>(
      `SELECT player_id, kind FROM media_upload WHERE status = 'accepted' AND purpose = 'round'`,
    )
    .toArray();
  return {
    gameId: room.game_id,
    sourceRevision: room.state_version,
    illustrative: resolved.status === "playable" && resolved.pack.illustrative,
    complete:
      room.phase === "podium" || room.phase === "final" || room.phase === "facts",
    players: players.map((player) => {
      const report = participating.get(player.player_id);
      return {
        playerId: player.player_id,
        nickname: player.nickname,
        clientClass: clientClassOf(player.client_class),
        family: report?.family ?? null,
        classification: report?.classification ?? null,
        reconnects: connections.get(player.player_id) ?? 0,
      };
    }),
    questions,
    answers,
    trolls: trolls.map((troll) => ({
      effectId: troll.effect_id,
      actorId: troll.actor_id,
      targetId: troll.target_id,
      kind: troll.kind,
      label: trollLabel(troll.kind),
      refunded: troll.refunded === 1,
    })),
    scores: [...totals.entries()].map(([playerId, points]) => ({ playerId, points })),
    revealedQuestionIds: [
      ...new Set(
        sql
          .exec<{ question_id: string }>(`SELECT question_id FROM score_ledger`)
          .toArray()
          .map((row) => row.question_id),
      ),
    ],
    mediaPlayers: media.flatMap((row) =>
      row.kind === "photo" || row.kind === "voice"
        ? [{ playerId: row.player_id, kind: row.kind }]
        : [],
    ),
    wallPhotos: sql
      .exec<{ post_id: string; player_id: string; reactions: number }>(
        `SELECT wall_post.post_id, wall_post.player_id,
                COALESCE((SELECT SUM(count) FROM wall_reaction
                          WHERE wall_reaction.post_id = wall_post.post_id), 0) AS reactions
         FROM wall_post
         JOIN media_upload ON media_upload.media_id = wall_post.media_id
         WHERE wall_post.status = 'shown' AND media_upload.hidden = 0`,
      )
      .toArray()
      .map((row) => ({
        postId: row.post_id,
        playerId: row.player_id,
        reactions: row.reactions,
      })),
  };
}

function questionRows(
  sql: SqlStorage,
  players: { player_id: string; joined_at: string | null }[],
  answers: StatsAnswer[],
  openedAt: number,
  packQuestions: readonly Question[],
): StatsQuestion[] {
  const ids = new Set<string>([
    ...answers.map((answer) => answer.questionId),
    ...sql
      .exec<{ question_id: string }>(`SELECT question_id FROM vote_elector`)
      .toArray()
      .map((row) => row.question_id),
    ...sql
      .exec<{ question_id: string }>(`SELECT question_id FROM duel_role`)
      .toArray()
      .map((row) => row.question_id),
  ]);
  const joined = new Map(
    players.map((player) => [
      player.player_id,
      player.joined_at ? Date.parse(player.joined_at) : openedAt,
    ]),
  );
  return [...ids].map((questionId) => {
    const demo = packQuestions.find((question) => question.id === questionId);
    const electors = sql
      .exec<{ player_id: string }>(
        `SELECT player_id FROM vote_elector WHERE question_id = ?`,
        questionId,
      )
      .toArray();
    const roles = sql
      .exec<{ player_id: string }>(
        `SELECT player_id FROM duel_role WHERE question_id = ?`,
        questionId,
      )
      .toArray();
    const choiceDeadlines = sql
      .exec<{ deadline_at: number }>(
        `SELECT deadline_at FROM choice_answer WHERE question_id = ?`,
        questionId,
      )
      .toArray();
    const ballotDeadlines = sql
      .exec<{ deadline_at: number }>(
        `SELECT deadline_at FROM vote_ballot WHERE question_id = ?`,
        questionId,
      )
      .toArray();
    const deadline = [...choiceDeadlines, ...ballotDeadlines].reduce(
      (max, row) => Math.max(max, row.deadline_at),
      0,
    );
    let eligible: string[] = [];
    if (electors.length > 0) {
      eligible = electors.map((row) => row.player_id);
    } else if (roles.length > 0) {
      eligible = roles.map((row) => row.player_id);
    } else if (deadline > 0) {
      eligible = players
        .filter((player) => (joined.get(player.player_id) ?? openedAt) <= deadline)
        .map((player) => player.player_id);
    }
    return {
      questionId,
      label: demo?.prompt ?? questionId,
      eligiblePlayerIds: eligible,
    };
  });
}

function readReport(json: string): ReportBits {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") {
      return { family: null, classification: null, screenGroup: null };
    }
    const record = parsed as {
      deviceFamily?: unknown;
      classification?: unknown;
      screenGroup?: unknown;
      screen?: { shortEdge?: unknown };
    };
    const family = typeof record.deviceFamily === "string" ? record.deviceFamily : null;
    const classification =
      record.classification === "reported" ||
      record.classification === "ambiguous" ||
      record.classification === "unknown"
        ? record.classification
        : null;
    const stored =
      record.screenGroup === "narrower" ||
      record.screenGroup === "wider" ||
      record.screenGroup === "unknown"
        ? record.screenGroup
        : null;
    const shortEdge =
      typeof record.screen?.shortEdge === "number" ? record.screen.shortEdge : null;
    return {
      family,
      classification,
      screenGroup:
        stored ?? (shortEdge === null ? null : reportedScreenGroup(shortEdge)),
    };
  } catch {
    return { family: null, classification: null, screenGroup: null };
  }
}

function clientClassOf(value: string): StatsSource["players"][number]["clientClass"] {
  if (
    value === "synthetic" ||
    value === "test" ||
    value === "host" ||
    value === "guest"
  ) {
    return value;
  }
  return "test";
}

function trollLabel(kind: string): string {
  if (kind in trollDefinitions) {
    return trollDefinitions[kind as TrollKind].label;
  }
  return kind;
}
