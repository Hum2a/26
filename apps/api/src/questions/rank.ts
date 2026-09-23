import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerHeldMessage,
  answerLateMessage,
  answerPausedMessage,
  rankClosedMessage,
  rankDuplicateMessage,
  rankMissingMessage,
  rankPartialMessage,
  rankTieMessage,
  rankUnknownMessage,
} from "../room/limits.ts";
import { submissionGate, type GameStore } from "../room/lifecycle.ts";
import type { RankPlacement, RankQuestion } from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { playableQuestions, questionPacks } from "./registry.ts";

export function assertRankQuestion(question: RankQuestion): void {
  const itemIds = new Set(question.items.map((item) => item.id));
  const tierIds = question.tiers.map((tier) => tier.id);
  const tierSet = new Set(tierIds);
  if (
    itemIds.size !== question.items.length ||
    tierSet.size !== question.tiers.length
  ) {
    throw new Error("Ranking items and positions need stable unique ids.");
  }
  if (
    question.ties === "forbidden" &&
    question.mode === "complete" &&
    question.tiers.length < question.items.length
  ) {
    throw new Error("A complete ranking without ties needs a position for every item.");
  }
  const seen = new Set<string>();
  for (const group of question.truth) {
    if (!tierSet.has(group.tierId)) {
      throw new Error("The ranking truth uses a position that is not on the question.");
    }
    if (question.ties === "forbidden" && group.itemIds.length > 1) {
      throw new Error("The ranking truth ties items when ties are forbidden.");
    }
    for (const itemId of group.itemIds) {
      if (!itemIds.has(itemId) || seen.has(itemId)) {
        throw new Error("The ranking truth must list each item once.");
      }
      seen.add(itemId);
    }
  }
  if (seen.size !== itemIds.size) {
    throw new Error("The ranking truth must list each item once.");
  }
}

export function checkRanking(
  question: RankQuestion,
  value: unknown,
): { ok: true; placements: RankPlacement[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: rankUnknownMessage };
  }
  const placements: RankPlacement[] = [];
  const items = new Set<string>();
  const tiers = new Set<string>();
  const knownItems = new Set(question.items.map((item) => item.id));
  const knownTiers = new Set(question.tiers.map((tier) => tier.id));
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, message: rankUnknownMessage };
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.itemId !== "string" || typeof record.tierId !== "string") {
      return { ok: false, message: rankUnknownMessage };
    }
    if (!knownItems.has(record.itemId) || !knownTiers.has(record.tierId)) {
      return { ok: false, message: rankUnknownMessage };
    }
    if (items.has(record.itemId)) {
      return { ok: false, message: rankDuplicateMessage };
    }
    if (question.ties === "forbidden" && tiers.has(record.tierId)) {
      return { ok: false, message: rankTieMessage };
    }
    items.add(record.itemId);
    tiers.add(record.tierId);
    placements.push({ itemId: record.itemId, tierId: record.tierId });
  }
  if (question.mode === "complete" && items.size !== knownItems.size) {
    return { ok: false, message: rankMissingMessage };
  }
  if (question.mode === "partial" && placements.length === 0) {
    return { ok: false, message: rankPartialMessage };
  }
  return { ok: true, placements };
}

/**
 * Points are floor(question.points * concordant strict pairs / strict truth pairs).
 * A guest tie scores 0 for that pair and does not subtract further.
 * A truth tie is not a pair. No comparable truth order awards the question's
 * own points for any accepted submission. Missing and reversed pairs score 0.
 * The result stays inside 0 and that question's points.
 */
export function pointsForRanking(
  question: RankQuestion,
  placements: RankPlacement[] | undefined,
): { points: number; detail: string } {
  if (!placements) {
    return { points: 0, detail: "missing" };
  }
  const truthRank = rankMap(
    question.truth.map((group) => [group.tierId, group.itemIds]),
  );
  const guestRank = rankMap(
    question.tiers.map((tier) => [
      tier.id,
      placements.filter((item) => item.tierId === tier.id).map((item) => item.itemId),
    ]),
  );
  const items = question.items.map((item) => item.id);
  let strictPairs = 0;
  let concordant = 0;
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const first = items[left];
      const second = items[right];
      if (!first || !second) {
        continue;
      }
      const truth = compare(truthRank, first, second);
      if (truth === 0 || truth === null) {
        continue;
      }
      strictPairs += 1;
      const guest = compare(guestRank, first, second);
      if (guest === truth) {
        concordant += 1;
      }
    }
  }
  if (strictPairs === 0) {
    return { points: question.points, detail: "unordered" };
  }
  const points = Math.floor((question.points * concordant) / strictPairs);
  return {
    points,
    detail: `agree-${concordant}/${strictPairs}`,
  };
}

export function acceptRanking(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: RankQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = submissionGate(store, now);
  if (!gate.ok) {
    if (gate.reason === "late") {
      return { ok: false, message: answerLateMessage };
    }
    if (gate.reason === "paused") {
      return { ok: false, message: answerPausedMessage };
    }
    if (gate.reason === "held") {
      return { ok: false, message: answerHeldMessage };
    }
    return { ok: false, message: answerClosedMessage };
  }
  const room = store.readRoom();
  if (room.phase !== "collect") {
    return { ok: false, message: answerClosedMessage };
  }
  const checked = checkRanking(question, value);
  if (!checked.ok) {
    return checked;
  }
  if (readRanking(sql, playerId, question)) {
    return { ok: false, message: answerDuplicateMessage };
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
    return { ok: false, message: answerLateMessage };
  }
  sql.exec(
    `INSERT INTO round_response (
       player_id, question_id, kind, payload, received_at, deadline_at, device_context_id
     ) VALUES (?, ?, 'rank', ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    JSON.stringify({ placements: checked.placements }),
    now,
    deadline,
    playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function readRanking(
  sql: SqlStorage,
  playerId: string,
  question: RankQuestion,
): RankPlacement[] | undefined {
  const row = sql
    .exec<{ payload: string }>(
      `SELECT payload FROM round_response
       WHERE player_id = ? AND question_id = ? AND kind = 'rank'`,
      playerId,
      question.id,
    )
    .toArray()[0];
  if (!row) {
    return undefined;
  }
  const parsed = JSON.parse(row.payload) as { placements?: unknown };
  const checked = checkRanking(question, parsed.placements);
  if (checked.ok) {
    return checked.placements;
  }
  if (!Array.isArray(parsed.placements)) {
    return undefined;
  }
  return parsed.placements.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.itemId !== "string" || typeof record.tierId !== "string") {
      return [];
    }
    return [{ itemId: record.itemId, tierId: record.tierId }];
  });
}

export function rankScores(sql: SqlStorage, question: RankQuestion, now: number): void {
  const players = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
    )
    .toArray();
  for (const player of players) {
    const scored = pointsForRanking(
      question,
      readRanking(sql, player.player_id, question),
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

export function publicRankQuestion(
  question: RankQuestion,
  index: number,
  total: number,
) {
  return {
    ...publicQuestionCore(question, index, total),
    kind: "rank" as const,
    mode: question.mode,
    ties: question.ties,
    items: question.items.map((item) => ({ id: item.id, label: item.label })),
    tiers: question.tiers.map((tier) => ({ id: tier.id, label: tier.label })),
  };
}

export function rankReveal(
  sql: SqlStorage,
  question: RankQuestion,
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
       WHERE round_response.question_id = ? AND round_response.kind = 'rank'
         AND player.revoked_at IS NULL
       ORDER BY player.rowid ASC`,
      question.id,
    )
    .toArray();
  return {
    kind: "rank" as const,
    order: question.truth.map((group) => ({
      tierId: group.tierId,
      label:
        question.tiers.find((tier) => tier.id === group.tierId)?.label ?? group.tierId,
      itemIds: group.itemIds,
    })),
    rankings: rows.flatMap((row) => {
      const parsed = JSON.parse(row.payload) as { placements?: RankPlacement[] };
      if (!Array.isArray(parsed.placements)) {
        return [];
      }
      return [
        {
          nickname: showNames ? row.nickname : null,
          points: row.points,
          placements: parsed.placements,
        },
      ];
    }),
  };
}

export function rankHostResponses(sql: SqlStorage, question: RankQuestion) {
  return sql
    .exec<{ player_id: string; nickname: string; payload: string }>(
      `SELECT round_response.player_id, player.nickname, round_response.payload
       FROM round_response
       JOIN player ON player.player_id = round_response.player_id
       WHERE round_response.question_id = ? AND round_response.kind = 'rank'
         AND player.revoked_at IS NULL
       ORDER BY round_response.received_at ASC`,
      question.id,
    )
    .toArray()
    .flatMap((row) => {
      const parsed = JSON.parse(row.payload) as { placements?: RankPlacement[] };
      if (!Array.isArray(parsed.placements)) {
        return [];
      }
      const summary = parsed.placements
        .map((placement) => {
          const item = question.items.find(
            (entry) => entry.id === placement.itemId,
          )?.label;
          const tier = question.tiers.find(
            (entry) => entry.id === placement.tierId,
          )?.label;
          return `${item ?? placement.itemId} ${tier ?? placement.tierId}`;
        })
        .join(", ");
      if (!summary) {
        return [];
      }
      return [{ playerId: row.player_id, nickname: row.nickname, summary }];
    });
}

export function wrongKindRank(): string {
  return rankClosedMessage;
}

function rankMap(
  groups: (readonly [string, readonly string[]])[],
): Map<string, number> {
  const ranks = new Map<string, number>();
  groups.forEach(([, itemIds], index) => {
    for (const itemId of itemIds) {
      ranks.set(itemId, index);
    }
  });
  return ranks;
}

function compare(
  ranks: Map<string, number>,
  left: string,
  right: string,
): -1 | 0 | 1 | null {
  const leftRank = ranks.get(left);
  const rightRank = ranks.get(right);
  if (leftRank === undefined || rightRank === undefined) {
    return null;
  }
  if (leftRank === rightRank) {
    return 0;
  }
  return leftRank < rightRank ? -1 : 1;
}

for (const pack of questionPacks) {
  if (pack.release !== "released") {
    continue;
  }
  for (const question of playableQuestions(pack)) {
    if (question.kind === "rank") {
      assertRankQuestion(question);
    }
  }
}
