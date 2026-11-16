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

export type KartPedal = "gas" | "brake" | null;

/** Push past this much of the pad's height, or at least 14 px, to hold a pedal. */
const pedalBand = (height: number) => Math.max(14, Math.min(28, height * 0.18));

/**
 * The thumb pad's vertical axis: push up from where the thumb landed to hold
 * the throttle, pull down to brake, and stay in the middle band to coast.
 */
export function pedalFromTravel(dy: number, height: number): KartPedal {
  if (!Number.isFinite(dy) || !Number.isFinite(height) || height <= 0) return null;
  const band = pedalBand(height);
  return dy <= -band ? "gas" : dy >= band ? "brake" : null;
}

/** Fixed-centre pads: above the middle accelerates, below brakes. */
export function pedalFromPointer(y: number, top: number, height: number): KartPedal {
  if (!Number.isFinite(y) || !Number.isFinite(top) || !Number.isFinite(height))
    return null;
  return pedalFromTravel(y - top - height / 2, height);
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
