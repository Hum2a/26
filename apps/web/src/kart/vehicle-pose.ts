/** Cosmetic rig angles from accepted motion, never an input or physics integrator. */
export function vehiclePose(
  motion: { speed: number; turnRate: number; travel: number },
  reducedMotion: boolean,
  dimensions = { wheelBase: 2.1, wheelRadius: 0.28 },
) {
  const finite = (value: number) => (Number.isFinite(value) ? value : 0);
  const speed = finite(motion.speed);
  const turn = finite(motion.turnRate);
  const wheelBase =
    Number.isFinite(dimensions.wheelBase) && dimensions.wheelBase > 0
      ? dimensions.wheelBase
      : 2.1;
  const wheelRadius =
    Number.isFinite(dimensions.wheelRadius) && dimensions.wheelRadius > 0
      ? dimensions.wheelRadius
      : 0.28;
  const clamp = (value: number, limit: number) =>
    Math.max(-limit, Math.min(limit, value));
  return {
    version: 1 as const,
    steering: clamp(Math.atan((turn * wheelBase) / Math.max(1, Math.abs(speed))), 0.5),
    roll: reducedMotion ? 0 : clamp(-turn * speed * 0.0075, 0.12),
    wheelRotation: reducedMotion
      ? 0
      : (finite(motion.travel) % (Math.PI * 2 * wheelRadius)) / wheelRadius,
  };
}
