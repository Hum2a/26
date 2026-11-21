/**
 * Each guest may send a troll whenever their own cooldown has run out.
 * The room stamps the time of each accepted troll; a refunded troll (one that
 * never started) does not count. Time is always passed in.
 */
export const trollCooldownMs = 90_000;

export type TrollCooldown = {
  /** True when a troll may be sent at `now`. */
  ready: boolean;
  /** Room-clock time the next troll may be sent, or null when ready. */
  until: number | null;
  /** Whole milliseconds left, 0 when ready. */
  remainingMs: number;
};

/**
 * Where a guest's cooldown stands. `lastSentAt` is the room-clock time of
 * their latest counted troll, or null when they have not sent one.
 */
export function trollCooldown(input: {
  lastSentAt: number | null;
  now: number;
  cooldownMs?: number;
}): TrollCooldown {
  const cooldownMs = input.cooldownMs ?? trollCooldownMs;
  if (input.lastSentAt === null || !Number.isFinite(input.lastSentAt)) {
    return { ready: true, until: null, remainingMs: 0 };
  }
  const until = input.lastSentAt + cooldownMs;
  if (input.now >= until) {
    return { ready: true, until: null, remainingMs: 0 };
  }
  return { ready: false, until, remainingMs: until - input.now };
}
