/** Normalised horizontal thumb travel with a small centre dead zone. */
export function steerFromPointer(x: number, left: number, width: number): number {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(left) ||
    !Number.isFinite(width) ||
    width <= 0
  )
    return 0;
  const raw = Math.max(-1, Math.min(1, (x - left - width / 2) / (width * 0.42)));
  const deadZone = 0.06;
  return Math.abs(raw) <= deadZone
    ? 0
    : (Math.sign(raw) * (Math.abs(raw) - deadZone)) / (1 - deadZone);
}

/**
 * Steering from thumb travel since the thumb landed, so touching the pad never
 * jerks the kart. Full lock is a comfortable thumb movement (between 48 and
 * 90 px, about a third of the pad), and a gentle curve keeps small
 * corrections small while still reaching full lock.
 */
export function steerFromTravel(dx: number, width: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(width) || width <= 0) return 0;
  const range = Math.max(48, Math.min(90, width * 0.32));
  const raw = Math.max(-1, Math.min(1, dx / range));
  const deadZone = 0.06;
  if (Math.abs(raw) <= deadZone) return 0;
  const linear = (Math.abs(raw) - deadZone) / (1 - deadZone);
  return Math.sign(raw) * linear ** 1.5;
}
