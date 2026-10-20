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
