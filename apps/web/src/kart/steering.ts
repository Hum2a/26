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
 * Linear steer from where the thumb landed. The first touch is centre. Sliding
 * to either edge of the zone is full lock, and anything past that edge stays there.
 */
export function steerFromGrab(
  fingerX: number,
  originX: number,
  left: number,
  width: number,
): number {
  if (
    !Number.isFinite(fingerX) ||
    !Number.isFinite(originX) ||
    !Number.isFinite(left) ||
    !Number.isFinite(width) ||
    width <= 0
  )
    return 0;
  const origin = Math.max(0, Math.min(1, (originX - left) / width));
  const finger = (fingerX - left) / width;
  const delta = finger - origin;
  if (delta === 0) return 0;
  const span = delta > 0 ? 1 - origin : origin;
  if (span <= 1e-6) return delta > 0 ? 1 : -1;
  return Math.max(-1, Math.min(1, delta / span));
}

/** Travel measured from the centre of the zone. The edge in that direction is full lock. */
export function steerFromTravel(dx: number, width: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(width) || width <= 0) return 0;
  return steerFromGrab(width / 2 + dx, width / 2, 0, width);
}
