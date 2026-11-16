/**
 * Pure helpers for planning the birthday running order. Nothing here saves:
 * the host reviews a suggestion and presses Save as usual.
 */

/** Series key: the first word of a question id ("council-…", "trolley-…"). */
export function seriesOf(id: string): string {
  return id.split("-")[0] ?? id;
}

/** Length of the longest run of back-to-back rounds from one series. */
export function longestRun(ids: readonly string[]): { series: string; length: number } {
  let best = { series: "", length: 0 };
  let run = 0;
  for (let i = 0; i < ids.length; i++) {
    run = i > 0 && seriesOf(ids[i]!) === seriesOf(ids[i - 1]!) ? run + 1 : 1;
    if (run > best.length) best = { series: seriesOf(ids[i]!), length: run };
  }
  return best;
}

/**
 * Spreads each series through the show. Rounds keep their order within a
 * series; rounds marked `last` (the kart race) stay at the end; at each step
 * the series with the most rounds left that differs from the previous round
 * goes next, so clusters break up wherever there is another series to use.
 */
export function suggestMixedOrder(
  ids: readonly string[],
  isLast: (id: string) => boolean = () => false,
): string[] {
  const tail = ids.filter(isLast);
  const queues = new Map<string, string[]>();
  for (const id of ids.filter((id) => !isLast(id))) {
    const key = seriesOf(id);
    queues.set(key, [...(queues.get(key) ?? []), id]);
  }
  const order: string[] = [];
  let previous = "";
  while ([...queues.values()].some((queue) => queue.length > 0)) {
    const candidates = [...queues.entries()]
      .filter(([key, queue]) => queue.length > 0 && key !== previous)
      .sort((a, b) => b[1].length - a[1].length);
    const [key, queue] =
      candidates[0] ?? [...queues.entries()].find(([, queue]) => queue.length > 0)!;
    order.push(queue.shift()!);
    previous = key;
  }
  return [...order, ...tail];
}

/** Total estimated seconds for an order, from each round's estimate. */
export function totalSeconds(
  ids: readonly string[],
  secondsOf: (id: string) => number | undefined,
): number {
  return ids.reduce((sum, id) => sum + (secondsOf(id) ?? 0), 0);
}

export function formatShowLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60
    ? `about ${minutes} min`
    : `about ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
