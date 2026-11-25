import {
  mapPinSchema,
  pinDistanceKm,
  wordleBoardSchema,
  type AnalyticsAnswer,
  type KartRace,
} from "@26/shared";
import type { Question } from "../questions/definition.ts";
import { hiddenAuthors } from "../questions/hidden-answers.ts";
import { pushLineAt } from "../questions/push-luck.ts";
import { readRoundState } from "../questions/round-state.ts";

type GuestNames = ReadonlyMap<string, string>;
type ResponseRow = {
  player_id: string;
  question_id: string;
  kind: AnalyticsAnswer["kind"];
  payload: string;
  received_at: number;
  deadline_at: number;
  device_context_id: string | null;
};

/** Receipts and retained mechanic results, without credentials or private question definitions. */
export function readAnalyticsAnswers(
  sql: SqlStorage,
  questions: ReadonlyMap<string, Question>,
  guests: GuestNames,
  version: string,
): AnalyticsAnswer[] {
  const rows = [
    ...sql.exec<ResponseRow>(`
      SELECT player_id, question_id, 'choice' AS kind, option_id AS payload, received_at, deadline_at, device_context_id FROM choice_answer
      UNION ALL SELECT player_id, question_id, kind, payload, received_at, deadline_at, device_context_id FROM round_response
      UNION ALL SELECT player_id, question_id, 'entry', body, received_at, deadline_at, device_context_id FROM text_response
    `),
    ...sql.exec<ResponseRow>(`
      SELECT player_id, question_id, 'ballot' AS kind, candidate_id AS payload, received_at, deadline_at, device_context_id FROM vote_ballot
      UNION ALL SELECT player_id, question_id, 'duel', CAST(value AS TEXT), received_at, deadline_at, device_context_id FROM duel_answer
      UNION ALL SELECT player_id, question_id, 'prediction', contestant_id, received_at, deadline_at, device_context_id FROM duel_prediction
    `),
  ].sort((left, right) => left.received_at - right.received_at);
  const candidates = new Map(
    sql
      .exec<{
        question_id: string;
        candidate_id: string;
        label: string;
        included: number;
        eligible: number;
      }>(
        `SELECT question_id, candidate_id, label, included, eligible FROM vote_candidate`,
      )
      .toArray()
      .map((row) => [`${row.question_id}:${row.candidate_id}`, row]),
  );
  const entries = new Map(
    rows
      .filter((row) => row.kind === "entry")
      .map((row) => [`${row.question_id}:${row.player_id}`, row.payload]),
  );
  const hidden = new Map<string, Set<string>>();
  const heatPlans = new Map<string, Record<string, [string, string][]>>();
  const answers: AnalyticsAnswer[] = [];
  for (const row of rows) {
    if (!guests.has(row.player_id)) continue;
    const [questionId, ballotType, step] =
      row.kind === "ballot" ? row.question_id.split(":") : [row.question_id];
    if (!questionId) continue;
    const question = questions.get(questionId);
    const base = {
      questionId,
      playerId: row.player_id,
      kind: row.kind,
      receivedAt: row.received_at,
      deadlineAt: row.deadline_at,
      deviceContextId: row.device_context_id,
      hidden: false,
    };
    switch (row.kind) {
      case "choice": {
        const optionIds = row.payload.split(",");
        const label = optionIds
          .map((id) =>
            question?.kind === "choice"
              ? (question.options.find((option) => option.id === id)?.label ?? id)
              : id,
          )
          .join(" · ");
        const push =
          question?.kind === "choice" && question.outcome.kind === "push"
            ? question.outcome
            : null;
        const bailLine =
          push && question && row.payload === "bail"
            ? pushLineAt(push, row.received_at, row.deadline_at, question.collectMs)
            : null;
        answers.push({
          ...base,
          label:
            bailLine !== null && push
              ? `Bailed at “${push.lines[bailLine] ?? label}”`
              : label,
          data: { optionIds, ...(push ? { bailLine } : {}) },
        });
        break;
      }
      case "ballot": {
        const candidate = candidates.get(`${questionId}:${row.payload}`);
        const labelOf = (id: string) =>
          candidates.get(`${questionId}:${id}`)?.label ??
          entries.get(`${questionId}:${id}`) ??
          guests.get(id) ??
          id;
        const label = labelOf(row.payload);
        const epoch = step === undefined ? null : Number(step);
        let pair: [string, string] | undefined;
        if (ballotType === "heat" && epoch !== null) {
          if (!heatPlans.has(questionId))
            heatPlans.set(
              questionId,
              readRoundState<Record<string, [string, string][]>>(
                sql,
                questionId,
                "vote-heat",
              ) ?? {},
            );
          pair = heatPlans.get(questionId)?.[row.player_id]?.[epoch];
        }
        const contest =
          ballotType === "heat"
            ? `Phone pair ${(epoch ?? 0) + 1}`
            : ballotType === "ballot"
              ? `Stage ballot ${(epoch ?? 0) + 1}`
              : null;
        answers.push({
          ...base,
          label: contest ? `${contest} · ${label}` : label,
          hidden: candidate?.included === 0,
          data: {
            candidateId: row.payload,
            label,
            contest,
            step: epoch,
            included: candidate ? candidate.included === 1 : null,
            eligible: candidate ? candidate.eligible === 1 : null,
            pair: pair?.map((id) => ({ id, label: labelOf(id) })) ?? null,
          },
        });
        break;
      }
      case "entry":
      case "typed": {
        const parsed = row.kind === "typed" ? parseObject(row.payload) : null;
        const body = row.kind === "entry" ? row.payload : parsed?.body;
        if (typeof body !== "string") break;
        if (!hidden.has(questionId))
          hidden.set(questionId, hiddenAuthors(sql, questionId));
        answers.push({
          ...base,
          label: body,
          data: { body },
          hidden: hidden.get(questionId)!.has(row.player_id),
        });
        break;
      }
      case "duel":
        answers.push({
          ...base,
          label: row.payload,
          data: { value: Number(row.payload) },
        });
        break;
      case "prediction":
        answers.push({
          ...base,
          label: guests.get(row.payload) ?? row.payload,
          data: { contestantId: row.payload },
        });
        break;
      case "slider": {
        const value = parseObject(row.payload)?.value;
        if (typeof value !== "number") break;
        const unit = question?.kind === "slider" ? question.unit : "";
        answers.push({
          ...base,
          label: `${value}${unit ? ` ${unit}` : ""}`,
          data: { value, unit },
        });
        break;
      }
      case "map-guess": {
        const pin = mapPinSchema.safeParse(parseObject(row.payload));
        if (!pin.success) break;
        const { lat, lng } = pin.data;
        const distanceKm =
          question?.kind === "map-guess"
            ? pinDistanceKm(pin.data, question.target)
            : null;
        const distance =
          distanceKm === null ? "" : ` · ${distanceKm.toFixed(2)} km away`;
        answers.push({
          ...base,
          label: `${lat}, ${lng}${distance}`,
          data: { lat, lng, distanceKm },
        });
        break;
      }
      case "rank": {
        const placements = parseObject(row.payload)?.placements;
        if (!Array.isArray(placements)) break;
        const groups = new Map<
          string,
          { label: string; items: { id: string; label: string }[] }
        >();
        if (question?.kind === "rank") {
          for (const tier of question.tiers)
            groups.set(tier.id, { label: tier.label, items: [] });
        }
        for (const placement of placements) {
          const { itemId, tierId } = placement ?? {};
          if (typeof itemId !== "string" || typeof tierId !== "string") continue;
          const group = groups.get(tierId) ?? { label: tierId, items: [] };
          group.items.push({
            id: itemId,
            label:
              question?.kind === "rank"
                ? (question.items.find((item) => item.id === itemId)?.label ?? itemId)
                : itemId,
          });
          groups.set(tierId, group);
        }
        const tiers = [...groups]
          .filter(([, group]) => group.items.length)
          .map(([id, group]) => ({ id, ...group }));
        answers.push({
          ...base,
          label: tiers
            .map(
              (tier) =>
                `${tier.label}: ${tier.items.map((item) => item.label).join(", ")}`,
            )
            .join("\n"),
          data: { tiers },
        });
        break;
      }
      case "wordle": {
        const board = wordleBoardSchema.safeParse(parseObject(row.payload));
        if (!board.success) break;
        answers.push({
          ...base,
          label: `${board.data.guesses.map((guess) => guess.word).join(" → ")} · ${board.data.status === "won" ? "Solved" : "Unsolved"}`,
          data: board.data,
        });
        break;
      }
      case "chess":
      case "kart":
        break;
    }
  }
  return [...answers, ...readGameResults(sql, guests, questions, version)];
}

function readGameResults(
  sql: SqlStorage,
  guests: GuestNames,
  questions: ReadonlyMap<string, Question>,
  version: string,
): AnalyticsAnswer[] {
  const answers: AnalyticsAnswer[] = [];
  const untimed = {
    receivedAt: null,
    deadlineAt: null,
    deviceContextId: null,
    hidden: false,
  };
  for (const row of sql.exec<{ question_id: string; payload: string }>(
    `SELECT question_id, payload FROM round_state WHERE state_key = 'kart-race'`,
  )) {
    const race = parseObject(row.payload) as KartRace | null;
    if (!Array.isArray(race?.drivers)) continue;
    for (const driver of race.drivers) {
      if (!guests.has(driver.playerId)) continue;
      const durationMs = driver.lapTimeMs ?? null;
      answers.push({
        ...untimed,
        playerId: driver.playerId,
        questionId: row.question_id,
        kind: "kart",
        label:
          durationMs === null ? driver.status : `${(durationMs / 1000).toFixed(3)} s`,
        data: {
          status: driver.status,
          durationMs,
          kartNumber: driver.number,
          gridPosition: driver.gridPosition ?? null,
          progress: driver.progress,
          checkpoint: driver.checkpoint,
          lapSplitsMs: driver.lapTimes ?? null,
          sectorCrossingsMs: driver.lap?.crossingsMs ?? null,
          recoveries: driver.lap?.recoveries ?? null,
          trackId: race.trackId ?? null,
          laps: race.laps ?? 1,
          endReason: race.endReason ?? null,
          timingMode: race.timingMode ?? "server",
        },
      });
    }
  }
  const legacyChessIds = new Map(
    [...questions.keys()].map((id, index) => [`${version}-${index}`, id]),
  );
  for (const row of sql.exec<{
    round_id: string;
    question_id: string | null;
    player_id: string;
    pgn: string;
    fen: string;
    player_time_ms: number;
    bot_time_ms: number;
    ply_count: number;
    status: string;
    winner: string | null;
    terminated_at: number | null;
    termination_reason: string | null;
  }>(`SELECT chess_game.round_id, json_extract(round_state.payload, '$') AS question_id,
              player_id, pgn, fen, player_time_ms, bot_time_ms, ply_count, status,
              winner, terminated_at, termination_reason
       FROM chess_game LEFT JOIN round_state ON round_state.question_id = chess_game.round_id
         AND round_state.state_key = 'chess-question'`)) {
    if (!guests.has(row.player_id)) continue;
    answers.push({
      ...untimed,
      playerId: row.player_id,
      questionId: row.question_id ?? legacyChessIds.get(row.round_id) ?? row.round_id,
      kind: "chess",
      receivedAt: row.terminated_at,
      label: [
        row.winner ?? row.status,
        row.termination_reason,
        `${row.ply_count} half-moves`,
      ]
        .filter(Boolean)
        .join(" · "),
      data: {
        status: row.status,
        winner: row.winner,
        reason: row.termination_reason,
        pgn: row.pgn,
        fen: row.fen,
        playerTimeMs: row.player_time_ms,
        opponentTimeMs: row.bot_time_ms,
        plyCount: row.ply_count,
        roundId: row.round_id,
      },
    });
  }
  return answers;
}

function parseObject(payload: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(payload);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
