/**
 * Offset from this device's clock to the room's clock, NTP style.
 * Each sample is a round trip; the fastest recent one is the most accurate,
 * because its unknown one-way split is smallest.
 */
type Sample = { offset: number; rtt: number; at: number };

const maxSamples = 8;
/** Network paths change when a phone roams. Old samples stop counting. */
const sampleTtlMs = 5 * 60_000;
let samples: Sample[] = [];

export function noteServerTime(
  sentAt: number,
  serverNow: number,
  receivedAt: number,
): void {
  const rtt = receivedAt - sentAt;
  if (!Number.isFinite(rtt) || rtt < 0 || rtt > 10_000) {
    return;
  }
  samples = [
    ...samples,
    { offset: serverNow - (sentAt + rtt / 2), rtt, at: receivedAt },
  ].slice(-maxSamples);
}

/** Milliseconds to add to `Date.now()` to read the room's clock, once measured. */
export function serverOffset(now = Date.now()): number | undefined {
  const fresh = samples.filter((sample) => now - sample.at <= sampleTtlMs);
  if (fresh.length === 0) {
    return undefined;
  }
  return fresh.reduce((best, sample) => (sample.rtt < best.rtt ? sample : best)).offset;
}

/**
 * Typical round trip to the room in milliseconds: the median of recent
 * samples, so one slow or one lucky ping does not swing it. Undefined until
 * measured.
 */
export function serverRoundTrip(now = Date.now()): number | undefined {
  const fresh = samples
    .filter((sample) => now - sample.at <= sampleTtlMs)
    .map((sample) => sample.rtt)
    .sort((a, b) => a - b);
  return fresh.length ? fresh[Math.floor(fresh.length / 2)] : undefined;
}

/** Answer phases whose deadline the phone can check before it sends. */
const answerPhases = new Set(["collect", "vote", "predict"]);

/**
 * True once the room's clock has passed this phase's deadline. Without a
 * measured offset it says false and leaves the decision to the room.
 */
export function deadlinePassed(
  snapshot:
    | { phase: string; paused: boolean; held: boolean; deadlineAt: number | null }
    | undefined,
  now = Date.now(),
): boolean {
  if (
    !snapshot ||
    snapshot.paused ||
    snapshot.held ||
    snapshot.deadlineAt === null ||
    !answerPhases.has(snapshot.phase)
  ) {
    return false;
  }
  const offset = serverOffset(now);
  return offset !== undefined && now + offset >= snapshot.deadlineAt;
}

export function resetServerClock(): void {
  samples = [];
}
