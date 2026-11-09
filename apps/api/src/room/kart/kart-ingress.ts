/** Fresh durable phase fields; the frozen roster is only an ingress hint. */
export type KartIngressClock = {
  phase: string;
  paused: number;
  hold: string | null;
  phase_generation: number;
  scope_generation: number;
  question_index: number;
  question_set_version: string;
};
type Roster = { raceId: string; players: readonly string[] };

/** Avoid rereading/parsing the frozen roster on every unacknowledged control.
 * Accepted inputs are still validated against durable room/player state at flush.
 */
export class KartIngressCache {
  private clock: KartIngressClock | undefined;
  private key: string | undefined;
  private roster: { raceId: string; players: ReadonlySet<string> } | undefined;

  /** A hint refreshed after durable room changes; never authority for acceptance. */
  readClock(load: () => KartIngressClock | undefined): KartIngressClock | undefined {
    this.clock ??= load();
    return this.clock;
  }

  refreshClock(clock: KartIngressClock | undefined): void {
    this.clock = clock;
  }

  allows(
    clock: KartIngressClock,
    playerId: string,
    raceId: string,
    load: () => Roster | undefined,
  ): boolean {
    if (clock.phase !== "collect" || clock.paused !== 0 || clock.hold) {
      this.key = undefined;
      this.roster = undefined;
      return false;
    }
    const key = [
      clock.scope_generation,
      clock.phase_generation,
      clock.question_index,
      clock.question_set_version,
    ].join(":");
    if (key !== this.key) {
      const roster = load();
      this.roster = roster
        ? { raceId: roster.raceId, players: new Set(roster.players) }
        : undefined;
      this.key = key;
    }
    return this.roster?.raceId === raceId && this.roster.players.has(playerId);
  }
}
