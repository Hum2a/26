import type { KartDriver } from "@26/shared";

export type KartPose = Pick<KartDriver, "x" | "z" | "heading">;
/** Visual smoothing only: no prediction, physics, checkpoint or timer authority. */
export function smoothKartPose(
  from: KartPose,
  to: KartPose,
  deltaSeconds: number,
  reduced: boolean,
): KartPose {
  if (reduced) return { x: to.x, z: to.z, heading: to.heading };
  const alpha = 1 - Math.exp(-14 * Math.max(0, Math.min(0.1, deltaSeconds)));
  const angle = Math.atan2(
    Math.sin(to.heading - from.heading),
    Math.cos(to.heading - from.heading),
  );
  return {
    x: from.x + (to.x - from.x) * alpha,
    z: from.z + (to.z - from.z) * alpha,
    heading: from.heading + angle * alpha,
  };
}
