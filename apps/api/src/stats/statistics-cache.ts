/**
 * Room statistics read every answer, ballot and score in the game. Rebuilding
 * them on every broadcast made each accepted answer slower as the night went on:
 * on the 19 November 2026 staging rehearsal, 80 guests' replies took 8–20 s after
 * the knockout rounds. Outside the end of the game nothing on screen needs them
 * newer than a few seconds, so a room reuses the last build briefly.
 *
 * The end phases always rebuild: the podium highlights, fun facts and final
 * recap must reflect every answer. Memory only; a restarted room rebuilds.
 */
export const statisticsMaxAgeMs = 5_000;

const alwaysFresh = new Set(["lobby", "final", "facts", "podium"]);

export type StatisticsKey = { questionIndex: number; phase: string };

export class StatisticsCache<T> {
  private entry: { at: number; key: string; value: T } | undefined;

  /** `force` rebuilds now, for a one-off read such as an admin snapshot request. */
  read(key: StatisticsKey, now: number, build: () => T, force = false): T {
    const id = `${key.questionIndex}:${key.phase}`;
    const entry = this.entry;
    if (
      !force &&
      entry &&
      !alwaysFresh.has(key.phase) &&
      entry.key === id &&
      now >= entry.at &&
      now - entry.at < statisticsMaxAgeMs
    ) {
      return entry.value;
    }
    const value = build();
    this.entry = { at: now, key: id, value };
    return value;
  }

  clear(): void {
    this.entry = undefined;
  }
}
