import {
  wordleBoardSchema,
  type NormalisedDeviceReport,
  type TrendDevice,
  type TrendInput,
  type TrendNumeric,
  type TrendPlayer,
  type TrendQuestion,
  type TrendResponse,
} from "@26/shared";
import { passwordKey } from "../../../../packages/shared/src/party-scoring.ts";
import type { Question } from "../questions/definition.ts";
import { hiddenAuthors } from "../questions/hidden-answers.ts";
import { pushLineAt } from "../questions/push-luck.ts";

/**
 * Reads one question's accepted answers, the device each was sent from and
 * the room's other context (scores so far, trolls, photos, joins) into a pure
 * `TrendInput`. Only guests count: host, test and synthetic players do not.
 * Written answers the host hid are never quoted; they still count for speed
 * and scores. One query per table, so it stays cheap for eighty phones.
 */
export function readTrendInput(
  sql: SqlStorage,
  questions: readonly Question[],
  index: number,
): TrendInput | null {
  const question = questions[index];
  if (!question) return null;
  const players = sql
    .exec<{
      player_id: string;
      nickname: string;
      avatar_media_id: string | null;
    }>(
      `SELECT player_id, nickname, avatar_media_id FROM player
       WHERE revoked_at IS NULL AND client_class = 'guest' ORDER BY rowid ASC`,
    )
    .toArray();
  if (players.length === 0) return null;
  const guestIds = new Set(players.map((player) => player.player_id));
  const contexts = new Map<string, TrendDevice | null>();
  const latestByPlayer = new Map<string, TrendDevice | null>();
  for (const row of sql
    .exec<{ context_id: string; player_id: string; report_json: string }>(
      `SELECT context_id, player_id, report_json FROM device_context ORDER BY created_at ASC`,
    )
    .toArray()) {
    const device = toTrendDevice(row.report_json);
    contexts.set(row.context_id, device);
    if (device) latestByPlayer.set(row.player_id, device);
  }
  const connections = new Map(
    sql
      .exec<{ player_id: string; reconnects: number; rtt_median_ms: number | null }>(
        `SELECT player_id, reconnects, rtt_median_ms FROM connection_summary`,
      )
      .toArray()
      .map((row) => [row.player_id, row]),
  );
  const ledger = sql
    .exec<{
      question_id: string;
      player_id: string;
      points: number;
      detail: string;
      created_at: number;
    }>(`SELECT question_id, player_id, points, detail, created_at FROM score_ledger`)
    .toArray();
  const adjustments = sql
    .exec<{ player_id: string; points: number; created_at: number }>(
      `SELECT player_id, points, created_at FROM score_adjustment`,
    )
    .toArray();
  const earlier = new Set(questions.slice(0, index).map((item) => item.id));
  const scoreBefore = new Map<string, number>();
  for (const row of ledger) {
    if (earlier.has(row.question_id)) {
      scoreBefore.set(
        row.player_id,
        (scoreBefore.get(row.player_id) ?? 0) + row.points,
      );
    }
  }
  // Host adjustments count only if made before this question's results were
  // recorded, so a later correction does not move someone into the leaders.
  const settledAt = ledger
    .filter((row) => row.question_id === question.id)
    .reduce((first, row) => Math.min(first, row.created_at), Number.POSITIVE_INFINITY);
  for (const row of adjustments) {
    if (row.created_at >= settledAt) continue;
    scoreBefore.set(row.player_id, (scoreBefore.get(row.player_id) ?? 0) + row.points);
  }
  const trolls = sql
    .exec<{ actor_id: string; target_id: string }>(
      `SELECT actor_id, target_id FROM troll_effect WHERE refunded = 0`,
    )
    .toArray();
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  for (const row of trolls) {
    sent.set(row.actor_id, (sent.get(row.actor_id) ?? 0) + 1);
    if (row.target_id !== row.actor_id) {
      received.set(row.target_id, (received.get(row.target_id) ?? 0) + 1);
    }
  }
  const photographers = new Set(
    sql
      .exec<{ player_id: string }>(
        `SELECT DISTINCT player_id FROM media_upload
         WHERE status = 'accepted' AND purpose != 'face'`,
      )
      .toArray()
      .map((row) => row.player_id),
  );
  const history = scoredHistory(questions, index, ledger, guestIds);
  const previous = history.at(-1)?.questionId;
  const previousPoints = new Map(
    ledger
      .filter((row) => row.question_id === previous)
      .map((row) => [row.player_id, row.points > 0]),
  );
  const trendPlayers: TrendPlayer[] = players.map((player, order) => {
    const connection = connections.get(player.player_id);
    return {
      playerId: player.player_id,
      nickname: player.nickname,
      joinOrder: order,
      device: latestByPlayer.get(player.player_id) ?? null,
      reconnects: connection?.reconnects ?? 0,
      rttMs: connection?.rtt_median_ms ?? null,
      scoreBefore: scoreBefore.get(player.player_id) ?? 0,
      trollsSent: sent.get(player.player_id) ?? 0,
      trollsReceived: received.get(player.player_id) ?? 0,
      sharedPhoto: photographers.has(player.player_id),
      hasAvatar: player.avatar_media_id !== null,
      previousCorrect: previousPoints.get(player.player_id) ?? null,
    };
  });
  const points = new Map(
    ledger
      .filter((row) => row.question_id === question.id)
      .map((row) => [row.player_id, row]),
  );
  const device = (contextId: string | null, playerId: string) =>
    (contextId ? contexts.get(contextId) : undefined) ??
    latestByPlayer.get(playerId) ??
    null;
  const read = readResponses(sql, question, points, device);
  return {
    question: read.question,
    players: trendPlayers,
    responses: read.responses.filter((response) => guestIds.has(response.playerId)),
    history,
  };
}

type LedgerRow = { player_id: string; points: number; detail: string };
type DeviceOf = (contextId: string | null, playerId: string) => TrendDevice | null;

function readResponses(
  sql: SqlStorage,
  question: Question,
  points: Map<string, LedgerRow>,
  device: DeviceOf,
): { question: TrendQuestion; responses: TrendResponse[] } {
  const base = {
    questionId: question.id,
    kind: question.kind as string,
    prompt: question.prompt,
  };
  const scoredBy = (playerId: string) => {
    const row = points.get(playerId);
    return row ? row.points > 0 : null;
  };
  const pointsOf = (playerId: string) => points.get(playerId)?.points ?? null;
  if (question.kind === "choice") {
    const rows = sql
      .exec<{
        player_id: string;
        option_id: string;
        received_at: number;
        deadline_at: number;
        device_context_id: string | null;
      }>(
        `SELECT player_id, option_id, received_at, deadline_at, device_context_id
         FROM choice_answer WHERE question_id = ?`,
        question.id,
      )
      .toArray();
    const outcome = question.outcome;
    const timing = (row: { received_at: number; deadline_at: number }) => ({
      elapsedMs: Math.max(0, row.received_at - (row.deadline_at - question.collectMs)),
      windowMs: question.collectMs,
    });
    if (outcome.kind === "push") {
      const options = [
        ...outcome.lines.map((line, line_) => ({
          id: `bail-${line_ + 1}`,
          label: `bailing at “${line}”`,
        })),
        { id: "hold", label: "holding their nerve" },
      ];
      return {
        question: {
          ...base,
          kind: "push",
          options,
          pickVerb: "went for",
          numeric: {
            noun: "points banked",
            unit: "pts",
            better: "higher",
            truth: null,
          },
          scored: true,
          success: "banked points",
          timed: false,
        },
        responses: rows.map((row) => ({
          playerId: row.player_id,
          picks:
            row.option_id === "bail"
              ? [
                  `bail-${
                    pushLineAt(
                      outcome,
                      row.received_at,
                      row.deadline_at,
                      question.collectMs,
                    ) + 1
                  }`,
                ]
              : ["hold"],
          value: pointsOf(row.player_id),
          correct: scoredBy(row.player_id),
          points: pointsOf(row.player_id),
          ...timing(row),
          device: device(row.device_context_id, row.player_id),
        })),
      };
    }
    const multiple = outcome.kind === "multiple";
    const scored = outcome.kind === "correct" || multiple;
    return {
      question: {
        ...base,
        kind: multiple ? "multiple" : "choice",
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
        pickVerb: multiple ? "ticked" : "picked",
        numeric: null,
        scored,
        success: "got it right",
        timed: true,
      },
      responses: rows.map((row) => ({
        playerId: row.player_id,
        picks: multiple ? row.option_id.split(",") : [row.option_id],
        value: null,
        correct:
          outcome.kind === "correct"
            ? row.option_id === question.correctOptionId
            : multiple
              ? scoredBy(row.player_id)
              : null,
        points: pointsOf(row.player_id),
        ...timing(row),
        device: device(row.device_context_id, row.player_id),
      })),
    };
  }
  if (
    question.kind === "typed" ||
    question.kind === "slider" ||
    question.kind === "rank"
  ) {
    const rows = sql
      .exec<{
        player_id: string;
        payload: string;
        received_at: number;
        deadline_at: number;
        device_context_id: string | null;
      }>(
        `SELECT player_id, payload, received_at, deadline_at, device_context_id
         FROM round_response WHERE question_id = ? AND kind = ?`,
        question.id,
        question.kind,
      )
      .toArray();
    const timing = (row: { received_at: number; deadline_at: number }) => ({
      elapsedMs: Math.max(0, row.received_at - (row.deadline_at - question.collectMs)),
      windowMs: question.collectMs,
    });
    if (question.kind === "typed") {
      const hidden = hiddenAuthors(sql, question.id);
      const labels = new Map<string, string>();
      const responses = rows.map((row) => {
        const body = readField(row.payload, "body");
        const key = typeof body === "string" ? passwordKey(body) : "";
        const quotable = key.length > 0 && !hidden.has(row.player_id);
        if (quotable && !labels.has(key)) labels.set(key, (body as string).trim());
        return {
          playerId: row.player_id,
          picks: quotable ? [`t:${key}`.slice(0, 120)] : [],
          value: null,
          correct: scoredBy(row.player_id),
          points: pointsOf(row.player_id),
          ...timing(row),
          device: device(row.device_context_id, row.player_id),
        };
      });
      return {
        question: {
          ...base,
          options: [...labels].map(([key, label]) => ({
            id: `t:${key}`.slice(0, 120),
            label,
          })),
          pickVerb: "typed",
          numeric: null,
          scored: true,
          success:
            question.scoring === "commonness" ? "matched someone" : "got it right",
          timed: true,
        },
        responses,
      };
    }
    if (question.kind === "slider") {
      const numeric: TrendNumeric = {
        noun: "guess",
        unit: question.unit,
        better: "closer",
        truth: question.truth,
        ...(question.scoring === "under" ? { overIsBust: true } : {}),
      };
      return {
        question: {
          ...base,
          options: [],
          pickVerb: "guessed",
          numeric,
          scored: true,
          success: "scored",
          timed: true,
        },
        responses: rows.map((row) => {
          const value = readField(row.payload, "value");
          return {
            playerId: row.player_id,
            picks: [],
            value: typeof value === "number" && Number.isFinite(value) ? value : null,
            correct: scoredBy(row.player_id),
            points: pointsOf(row.player_id),
            ...timing(row),
            device: device(row.device_context_id, row.player_id),
          };
        }),
      };
    }
    const firstTier = question.tiers[0]?.id;
    const buckets = question.input === "buckets";
    return {
      question: {
        ...base,
        options: buckets
          ? []
          : question.items.map((item) => ({ id: item.id, label: item.label })),
        pickVerb: "ranked first",
        numeric: { noun: "points", unit: "pts", better: "higher", truth: null },
        scored: false,
        success: "scored",
        timed: true,
      },
      responses: rows.map((row) => {
        const placements = readField(row.payload, "placements");
        const first = Array.isArray(placements)
          ? placements.find(
              (item): item is { itemId: string; tierId: string } =>
                !!item &&
                typeof item === "object" &&
                (item as { tierId?: unknown }).tierId === firstTier &&
                typeof (item as { itemId?: unknown }).itemId === "string",
            )
          : undefined;
        return {
          playerId: row.player_id,
          picks: !buckets && first ? [first.itemId] : [],
          value: pointsOf(row.player_id),
          correct: null,
          points: pointsOf(row.player_id),
          ...timing(row),
          device: device(row.device_context_id, row.player_id),
        };
      }),
    };
  }
  if (question.kind === "vote" || question.kind === "guess") {
    const hidden = hiddenAuthors(sql, question.id);
    const candidates = sql
      .exec<{ candidate_id: string; owner_id: string | null; label: string }>(
        `SELECT candidate_id, owner_id, label FROM vote_candidate
         WHERE question_id = ? AND included = 1`,
        question.id,
      )
      .toArray()
      .filter(
        (row) =>
          !row.owner_id || !hidden.has(row.owner_id) || question.kind === "guess",
      );
    const quotable = new Set(candidates.map((row) => row.candidate_id));
    const rows = sql
      .exec<{
        player_id: string;
        candidate_id: string;
        received_at: number;
        deadline_at: number;
        device_context_id: string | null;
      }>(
        `SELECT player_id, candidate_id, received_at, deadline_at, device_context_id
         FROM vote_ballot WHERE question_id = ?`,
        question.id,
      )
      .toArray();
    const window = question.kind === "vote" ? question.voteMs : question.collectMs;
    const scored = question.kind === "guess" && question.scoring !== "none";
    return {
      question: {
        ...base,
        options: candidates.map((row) => ({ id: row.candidate_id, label: row.label })),
        pickVerb: question.kind === "vote" ? "voted for" : "pointed at",
        numeric: null,
        scored,
        success: "backed the room's pick",
        timed: true,
      },
      responses: rows.map((row) => ({
        playerId: row.player_id,
        picks: quotable.has(row.candidate_id) ? [row.candidate_id] : [],
        value: null,
        correct: scored ? scoredBy(row.player_id) : null,
        points: pointsOf(row.player_id),
        elapsedMs: Math.max(0, row.received_at - (row.deadline_at - window)),
        windowMs: window,
        device: device(row.device_context_id, row.player_id),
      })),
    };
  }
  if (question.kind === "wordle") {
    const rows = sql
      .exec<{
        player_id: string;
        payload: string;
        received_at: number;
        deadline_at: number;
        device_context_id: string | null;
      }>(
        `SELECT player_id, payload, received_at, deadline_at, device_context_id
         FROM round_response WHERE question_id = ? AND kind = 'wordle'`,
        question.id,
      )
      .toArray();
    const openers = new Set<string>();
    const responses = rows.flatMap((row) => {
      let board;
      try {
        board = wordleBoardSchema.parse(JSON.parse(row.payload));
      } catch {
        return [];
      }
      const opener = board.guesses[0]?.word;
      // The answer itself is only quoted after the reveal, which is when trends show.
      if (opener) openers.add(opener);
      const won = board.status === "won";
      return [
        {
          playerId: row.player_id,
          picks: opener ? [`w:${opener}`] : [],
          value: won ? board.guesses.length : null,
          correct: board.status === "playing" && !won ? false : won,
          points: pointsOf(row.player_id),
          elapsedMs: Math.max(
            0,
            row.received_at - (row.deadline_at - question.collectMs),
          ),
          windowMs: question.collectMs,
          device: device(row.device_context_id, row.player_id),
        },
      ];
    });
    return {
      question: {
        ...base,
        options: [...openers].map((word) => ({ id: `w:${word}`, label: word })),
        pickVerb: "opened with",
        numeric: { noun: "guesses", unit: "guesses", better: "lower", truth: null },
        scored: true,
        success: "solved it",
        timed: true,
      },
      responses,
    };
  }
  if (question.kind === "chess") {
    const games = sql
      .exec<{
        player_id: string;
        winner: string | null;
        status: string;
        ply_count: number;
      }>(
        `SELECT player_id, winner, status, ply_count FROM chess_game WHERE round_id = ?`,
        question.id,
      )
      .toArray();
    return {
      question: {
        ...base,
        options: [],
        pickVerb: "finished",
        numeric: { noun: "chess points", unit: "pts", better: "higher", truth: null },
        scored: true,
        success: "beat the bot",
        timed: false,
      },
      responses: games.map((game) => ({
        playerId: game.player_id,
        picks: [],
        value: pointsOf(game.player_id) ?? 0,
        correct: game.winner === "player",
        points: pointsOf(game.player_id),
        elapsedMs: null,
        windowMs: null,
        device: device(null, game.player_id),
      })),
    };
  }
  if (question.kind === "kart") {
    return {
      question: {
        ...base,
        options: [],
        pickVerb: "finished",
        numeric: { noun: "finish time", unit: "s", better: "lower", truth: null },
        scored: true,
        success: "finished the race",
        timed: false,
      },
      responses: [...points.values()].map((row) => {
        const match = /^kart:finished:(\d+)$/.exec(row.detail);
        return {
          playerId: row.player_id,
          picks: [],
          value: match ? Number(match[1]) / 1000 : null,
          correct: match !== null,
          points: row.points,
          elapsedMs: null,
          windowMs: null,
          device: device(null, row.player_id),
        };
      }),
    };
  }
  if (question.kind === "duel" || question.kind === "finale") {
    const rows = sql
      .exec<{
        player_id: string;
        value: number;
        received_at: number;
        deadline_at: number;
        device_context_id: string | null;
      }>(
        `SELECT player_id, value, received_at, deadline_at, device_context_id
         FROM duel_answer WHERE question_id = ?`,
        question.id,
      )
      .toArray();
    return {
      question: {
        ...base,
        options: [],
        pickVerb: "guessed",
        numeric: { noun: "guess", unit: "", better: "closer", truth: question.target },
        scored: true,
        success: "won their duel",
        timed: true,
      },
      responses: rows.map((row) => ({
        playerId: row.player_id,
        picks: [],
        value: row.value,
        correct: scoredBy(row.player_id),
        points: pointsOf(row.player_id),
        elapsedMs: Math.max(
          0,
          row.received_at - (row.deadline_at - question.collectMs),
        ),
        windowMs: question.collectMs,
        device: device(row.device_context_id, row.player_id),
      })),
    };
  }
  return {
    question: {
      ...base,
      options: [],
      pickVerb: "answered",
      numeric: { noun: "points", unit: "pts", better: "higher", truth: null },
      scored: true,
      success: "scored",
      timed: false,
    },
    responses: [...points.values()].map((row) => ({
      playerId: row.player_id,
      picks: [],
      value: row.points,
      correct: row.points > 0,
      points: row.points,
      elapsedMs: null,
      windowMs: null,
      device: device(null, row.player_id),
    })),
  };
}

/** Accuracy of earlier questions that someone could get right or wrong. */
function scoredHistory(
  questions: readonly Question[],
  index: number,
  ledger: readonly { question_id: string; player_id: string; points: number }[],
  guests: ReadonlySet<string>,
): { questionId: string; accuracy: number }[] {
  const history: { questionId: string; accuracy: number }[] = [];
  for (const question of questions.slice(0, index)) {
    if (!hasRightAndWrong(question)) continue;
    const rows = ledger.filter(
      (row) => row.question_id === question.id && guests.has(row.player_id),
    );
    if (rows.length === 0) continue;
    history.push({
      questionId: question.id,
      accuracy: rows.filter((row) => row.points > 0).length / rows.length,
    });
  }
  return history;
}

/**
 * Whether a guest can score or miss on this question, so it belongs in the
 * game's accuracy history and the "last question's winners" streak. This
 * matches `scored` in `readResponses`. Polls, room-split thresholds, open
 * votes and proportional rankings have no right or wrong answer.
 */
export function hasRightAndWrong(question: Question): boolean {
  switch (question.kind) {
    case "choice":
      return (
        question.outcome.kind === "correct" ||
        question.outcome.kind === "multiple" ||
        question.outcome.kind === "push"
      );
    case "guess":
      return question.scoring !== "none";
    case "typed":
    case "slider":
    case "wordle":
    case "chess":
    case "kart":
    case "duel":
    case "finale":
      return true;
    case "rank":
    case "vote":
      return false;
  }
}

function readField(payload: string, field: string): unknown {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)[field]
      : undefined;
  } catch {
    return undefined;
  }
}

/** The fields trends compare, from a stored normalised report. */
export function toTrendDevice(json: string): TrendDevice | null {
  let report: NormalisedDeviceReport;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !("deviceFamily" in parsed))
      return null;
    report = parsed as NormalisedDeviceReport;
  } catch {
    return null;
  }
  return {
    family: report.deviceFamily,
    os: report.osFamily,
    osMajor: report.osMajor,
    browser: report.browserFamily,
    colorScheme: report.presentation?.colorScheme ?? "unknown",
    reducedMotion: report.presentation?.reducedMotion ?? "unknown",
    language: report.locale?.languages?.[0] ?? null,
    timeZone: report.locale?.timeZone ?? null,
    shortEdge: report.screen?.shortEdge ?? null,
    pixelRatio: report.pixelRatio ?? null,
    orientation: report.orientation ?? "unknown",
    memoryGb: report.hardware?.memoryGb ?? null,
    quality: report.network?.quality ?? "unknown",
    saveData: report.network?.saveData ?? null,
  };
}
