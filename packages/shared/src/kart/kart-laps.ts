/** The persisted checkpoint cursor used by the authoritative party race.
 * `angle` is centreline metres on the circuit, radians on the legacy ring.
 */
export type KartLapCursor = {
  angle: number;
  distance: number;
  checkpoint: number;
};

export type KartLapStep = {
  along: number;
  lapLength: number;
  speed: number;
  stepMs: number;
  /** Present for the circuit's physical ordered gates; absent for legacy rings. */
  routeDistance?: number;
};

/** Circuit gates require physical crossings, never accumulated short loops.
 * Reusable by room driving and practice: neither a client lap claim nor a clock.
 * Callers own movement, active time, recovery and the resulting finish action.
 * This preserves the existing circuit and legacy-ring race arithmetic.
 */
export function advanceKartLap(cursor: KartLapCursor, step: KartLapStep) {
  const { along, lapLength, routeDistance, speed, stepMs } = step;
  let change = along - cursor.angle;
  if (change > lapLength / 2) change -= lapLength;
  if (change < -lapLength / 2) change += lapLength;
  const ordered = routeDistance !== undefined;
  const plausible =
    !ordered ||
    (routeDistance <= 20 &&
      Math.abs(change) <= Math.abs(speed) * (stepMs / 1000) * 2 + 2);
  const nextCheckpoint = ((cursor.checkpoint + 1) * lapLength) / 8;
  let safeProgress = plausible;
  let distance = cursor.distance;
  let checkpoint = cursor.checkpoint;
  if (ordered) {
    const unwrap = (value: number) =>
      checkpoint === 0 && value > lapLength / 2
        ? value - lapLength
        : checkpoint === 7 && value < lapLength / 8
          ? value + lapLength
          : value;
    const previous = unwrap(cursor.angle),
      candidate = unwrap(along);
    const crossed =
      plausible &&
      change > 0 &&
      previous < nextCheckpoint &&
      candidate >= nextCheckpoint;
    safeProgress = plausible && (candidate < nextCheckpoint || crossed);
    if (safeProgress) distance = candidate;
    if (crossed && checkpoint < 8) checkpoint += 1;
  } else {
    if (plausible) distance = Math.max(-lapLength, distance + change);
    if (change > 0 && distance >= nextCheckpoint && checkpoint < 8) checkpoint += 1;
  }
  return {
    angle: along,
    distance,
    checkpoint,
    progress: Math.min(1, Math.max(0, distance / lapLength)),
    safeProgress,
    finished: checkpoint === 8 && distance >= lapLength,
  };
}
