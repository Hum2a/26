/** Pure, deterministic crowd scoring. Inputs are accepted, eligible server responses only. */
export function passwordKey(body: string): string {
  return body.normalize("NFKC").trim().toLocaleLowerCase("en-GB").replace(/\s+/gu, " ");
}

export function commonnessResults(
  rows: readonly { playerId: string; body: string }[],
  points: number,
) {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(passwordKey(row.body), (counts.get(passwordKey(row.body)) ?? 0) + 1);
  const frequencies = [...new Set(counts.values())].sort((a, b) => b - a);
  const top = frequencies[0] ?? 0;
  return rows.map((row) => {
    const count = counts.get(passwordKey(row.body)) ?? 0;
    return {
      ...row,
      count,
      rank: frequencies.indexOf(count) + 1,
      points: top <= 1 ? 0 : Math.round((points * (count - 1)) / (top - 1)),
    };
  });
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function estimateAwards(input: {
  mode: "under" | "consensus";
  target: number | null;
  values: readonly number[];
  points: number;
  minimum: number;
  maximum: number;
}): { target: number | null; awards: number[] } {
  const target = input.mode === "consensus" ? median(input.values) : input.target;
  if (target === null) return { target, awards: input.values.map(() => 0) };
  const best = Math.max(
    -Infinity,
    ...input.values.filter((value) => value <= target + 1e-8),
  );
  return {
    target,
    awards: input.values.map((value) =>
      input.mode === "under"
        ? Math.abs(value - best) < 1e-8
          ? input.points
          : 0
        : Math.max(
            0,
            Math.round(
              input.points *
                (1 - Math.abs(value - target) / (input.maximum - input.minimum)),
            ),
          ),
    ),
  };
}

/** Equal mean positions remain a tie in the target; they never acquire a fabricated ordering. */
export function consensusRanking(
  items: readonly string[],
  tiers: readonly string[],
  rankings: readonly (readonly { itemId: string; tierId: string }[])[],
) {
  const totals = items
    .map((itemId) => {
      const positions = rankings.flatMap((row) => {
        const placement = row.find((p) => p.itemId === itemId);
        const index = placement ? tiers.indexOf(placement.tierId) : -1;
        return index < 0 ? [] : [index];
      });
      return {
        itemId,
        mean: positions.length
          ? positions.reduce((a, b) => a + b, 0) / positions.length
          : null,
      };
    })
    .filter((row): row is { itemId: string; mean: number } => row.mean !== null)
    .sort((a, b) => a.mean - b.mean);
  const groups: { tierId: string; itemIds: string[]; mean: number }[] = [];
  for (const row of totals) {
    const previous = groups.at(-1);
    if (previous && Math.abs(previous.mean - row.mean) < 1e-8)
      previous.itemIds.push(row.itemId);
    else
      groups.push({
        tierId: tiers[groups.length]!,
        itemIds: [row.itemId],
        mean: row.mean,
      });
  }
  return groups.map(({ tierId, itemIds }) => ({ tierId, itemIds }));
}

export function sameAnswerSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((id) => right.includes(id))
  );
}

export type PartyVoteFlow = {
  kind: "tournament" | "awards";
  step: number;
  queue: string[][];
  next: string[];
  labels: string[];
  ids: string[];
  finished: boolean;
  winners: string[];
  results: {
    label: string;
    winners: string[];
    votes: number;
    counts: Record<string, number>;
  }[];
};

function pairRound(ids: string[]) {
  const queue: string[][] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) queue.push(ids.slice(i, i + 2));
  return { queue, next: ids.length % 2 ? ids.slice(-1) : [] };
}

/** ids are randomly seeded once by the server, persisted before voting. */
export function createPartyVoteFlow(
  kind: PartyVoteFlow["kind"],
  ids: string[],
  labels: string[] = [],
): PartyVoteFlow {
  return {
    kind,
    ids,
    labels,
    step: 0,
    ...pairRound(ids),
    finished: kind === "tournament" && ids.length < 2,
    winners: [],
    results: [],
  };
}

export function flowCandidateIds(flow: PartyVoteFlow): string[] {
  return flow.finished ? [] : flow.kind === "awards" ? flow.ids : (flow.queue[0] ?? []);
}

/** Ties in a knockout use the frozen random seed order; ordinary award ties share the win. */
export function settlePartyVoteFlow(
  flow: PartyVoteFlow,
  ballots: readonly string[],
  eligible: readonly string[],
): PartyVoteFlow {
  if (flow.finished) return flow;
  const live = flowCandidateIds(flow).filter((id) => eligible.includes(id));
  const votes = ballots.filter((id) => live.includes(id));
  const counts = live.map((id) => ({
    id,
    count: votes.filter((v) => v === id).length,
  }));
  const top = Math.max(0, ...counts.map((row) => row.count));
  const tied = counts.filter((row) => row.count === top).map((row) => row.id);
  const winners = flow.kind === "awards" ? (top ? tied : []) : tied.slice(0, 1);
  const results = [
    ...flow.results,
    {
      label:
        flow.kind === "awards" ? flow.labels[flow.step]! : `Match ${flow.step + 1}`,
      winners,
      votes: votes.length,
      counts: Object.fromEntries(counts.map((row) => [row.id, row.count])),
    },
  ];
  if (flow.kind === "awards")
    return {
      ...flow,
      results,
      step: flow.step + 1,
      finished: flow.step + 1 >= flow.labels.length,
      winners: [...new Set(results.flatMap((row) => row.winners))],
    };
  const queue = flow.queue.slice(1),
    next = [...flow.next, ...winners];
  if (queue.length) return { ...flow, results, queue, next, step: flow.step + 1 };
  if (next.length <= 1)
    return {
      ...flow,
      results,
      queue: [],
      next: [],
      step: flow.step + 1,
      finished: true,
      winners: results.some((row) => row.votes > 0) ? next : [],
    };
  return { ...flow, results, ...pairRound(next), step: flow.step + 1 };
}
