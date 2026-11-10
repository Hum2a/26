/**
 * Who picked what, on the big screen. The room sends each option's voters in
 * arrival order to the stage and the host only (never to guest phones). This
 * file turns that list into the numbers the vote board draws. Pure: no clock,
 * no DOM, so the same input always draws the same board.
 */

export const voterDisplayModes = ["question", "hidden"] as const;

/**
 * `question` follows each question's own attribution (live, after or never).
 * `hidden` is the host's room-wide switch: nobody's picks reach the projector.
 */
export type VoterDisplayMode = (typeof voterDisplayModes)[number];

export type OptionVoters = { optionId: string; playerIds: readonly string[] };

export type VoteShare = {
  optionId: string;
  /** People on this option. */
  count: number;
  /** Fraction of every pick in the room, 0 to 1. */
  share: number;
  /** Size against the most popular option, 0 to 1. The leader is 1. */
  grow: number;
  /** Most picks, with at least one. Ties all lead. */
  leading: boolean;
  /** Voters in arrival order; empty when only a count is known. */
  playerIds: readonly string[];
};

/**
 * One row per option, in the question's order. Voters win over a bare tally;
 * a tally (a poll reveal with names switched off) still sizes the options.
 */
export function voteShares(
  optionIds: readonly string[],
  voters: readonly OptionVoters[] | null | undefined,
  tally?: readonly { optionId: string; count: number }[] | null,
): VoteShare[] {
  const rows = optionIds.map((optionId) => {
    const named = voters?.find((row) => row.optionId === optionId);
    const counted = tally?.find((row) => row.optionId === optionId)?.count;
    const playerIds = named ? uniqueIds(named.playerIds) : [];
    const count = named ? playerIds.length : Math.max(0, counted ?? 0);
    return { optionId, count, playerIds };
  });
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const top = rows.reduce((most, row) => Math.max(most, row.count), 0);
  return rows.map((row) => ({
    ...row,
    share: total === 0 ? 0 : row.count / total,
    grow: top === 0 ? 0 : row.count / top,
    leading: top > 0 && row.count === top,
  }));
}

/**
 * How many face bubbles one option draws before it collapses the rest into
 * "+N". The whole board stays near `boardBudget` bubbles so eighty guests on
 * two options do not paint eighty images in one box.
 */
export function bubbleLimit(optionCount: number, boardBudget = 72): number {
  const options = Math.max(1, Math.floor(optionCount));
  return Math.max(6, Math.min(40, Math.floor(boardBudget / options)));
}

/** The newest voters stay visible: a late pick should still pop in. */
export function visibleVoters(
  playerIds: readonly string[],
  limit: number,
): { shown: string[]; overflow: number } {
  const cap = Math.max(0, Math.floor(limit));
  if (playerIds.length <= cap) {
    return { shown: [...playerIds], overflow: 0 };
  }
  return {
    shown: playerIds.slice(playerIds.length - cap),
    overflow: playerIds.length - cap,
  };
}

/** Players who appeared since the last board, so only they animate in. */
export function newVoters(
  before: readonly OptionVoters[] | null | undefined,
  after: readonly OptionVoters[] | null | undefined,
): Set<string> {
  const seen = new Set<string>();
  for (const row of before ?? []) {
    for (const id of row.playerIds) seen.add(`${row.optionId}:${id}`);
  }
  const fresh = new Set<string>();
  for (const row of after ?? []) {
    for (const id of row.playerIds) {
      if (!seen.has(`${row.optionId}:${id}`)) fresh.add(id);
    }
  }
  return fresh;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
