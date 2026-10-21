/**
 * Token bucket. A sender may burst up to `capacity`, then is held to
 * `refillPerSecond`. Time is injected. Buckets live in room memory: a restart
 * forgives everyone, which is the safe direction for a party.
 */
export type RateBucket = { tokens: number; at: number };
export type RateLimit = { capacity: number; refillPerSecond: number };

export function takeToken(
  bucket: RateBucket | undefined,
  limit: RateLimit,
  now: number,
): { allowed: boolean; bucket: RateBucket } {
  const elapsed = bucket ? Math.max(0, now - bucket.at) / 1000 : 0;
  const tokens = Math.min(
    limit.capacity,
    (bucket?.tokens ?? limit.capacity) + elapsed * limit.refillPerSecond,
  );
  if (tokens < 1) {
    return { allowed: false, bucket: { tokens, at: now } };
  }
  return { allowed: true, bucket: { tokens: tokens - 1, at: now } };
}

/** Answers, votes, reactions and snapshot requests from one phone. */
export const commandRateLimit: RateLimit = { capacity: 30, refillPerSecond: 3 };
/** Live drafts. The phone sends at most five a second while typing. */
export const draftRateLimit: RateLimit = { capacity: 10, refillPerSecond: 6 };
/** Clock samples: five on connect, then one every twenty seconds. */
export const timeRateLimit: RateLimit = { capacity: 8, refillPerSecond: 0.25 };
/** Device and connection reports: on phase changes, resizes and once a minute. */
export const telemetryRateLimit: RateLimit = { capacity: 20, refillPerSecond: 0.2 };
