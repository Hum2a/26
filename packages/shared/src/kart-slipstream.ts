/**
 * Slipstream: sit close behind another kart at speed and the draft charges;
 * once charged, the kart has less drag for a moment, which lifts its top
 * speed by roughly an eighth. Karts stay ghosts, so this is the one way
 * other karts change your driving. Pure and server-authoritative.
 */
export const slipstreamTuning = {
  /** Closer than this is alongside, not behind. */
  minGap: 2.5,
  /** Farther than this, the wake has gone. */
  maxGap: 16,
  /** Half the width of the wake behind a kart. */
  halfWidth: 2.6,
  /** Both karts must be moving at least this fast (metres a second). */
  minSpeed: 12,
  /** How long to stay in a wake before the draft is ready. */
  chargeMs: 1000,
  /** How long the reduced drag lasts once it triggers. */
  bonusMs: 1600,
  /** Drag while slipstreaming; 0.7 gives about 12% more top speed. */
  dragScale: 0.7,
} as const;

export type SlipstreamKart = {
  playerId: string;
  x: number;
  z: number;
  heading: number;
  /** Forward speed in metres a second. */
  speed: number;
};

export type SlipstreamState = { draftMs: number; slipstreamMs: number };

/** Whether `self` is sitting in the wake of `ahead`. */
export function inWake(self: SlipstreamKart, ahead: SlipstreamKart): boolean {
  if (self.playerId === ahead.playerId) return false;
  const t = slipstreamTuning;
  if (self.speed < t.minSpeed || ahead.speed < t.minSpeed) return false;
  // Both karts must be pointing roughly the same way.
  if (Math.cos(self.heading - ahead.heading) < 0.8) return false;
  const fx = Math.cos(self.heading),
    fz = Math.sin(self.heading);
  const dx = ahead.x - self.x,
    dz = ahead.z - self.z;
  const along = dx * fx + dz * fz;
  if (along < t.minGap || along > t.maxGap) return false;
  return Math.abs(dx * -fz + dz * fx) <= t.halfWidth;
}

/** One step of the draft charge and the reduced-drag timer. */
export function stepSlipstream(
  state: SlipstreamState,
  self: SlipstreamKart,
  others: readonly SlipstreamKart[],
  ms: number,
): SlipstreamState {
  const t = slipstreamTuning;
  if (!Number.isFinite(ms) || ms <= 0) return state;
  if (state.slipstreamMs > 0)
    return { draftMs: 0, slipstreamMs: Math.max(0, state.slipstreamMs - ms) };
  if (others.some((other) => inWake(self, other))) {
    const draftMs = state.draftMs + ms;
    return draftMs >= t.chargeMs
      ? { draftMs: 0, slipstreamMs: t.bonusMs }
      : { draftMs, slipstreamMs: 0 };
  }
  // Leaving the wake bleeds the charge away twice as fast as it built.
  return { draftMs: Math.max(0, state.draftMs - ms * 2), slipstreamMs: 0 };
}

/** What a phone shows: nothing, a charging draft or the active slipstream. */
export function slipstreamPhase(state: SlipstreamState | undefined) {
  if (!state) return undefined;
  if (state.slipstreamMs > 0) return "active" as const;
  return state.draftMs >= 250 ? ("charging" as const) : undefined;
}
