import type { KartDriver } from "@26/shared";

export type KartPose = Pick<KartDriver, "x" | "z" | "heading" | "height">;

/** Plain render contract shared by the two Three versions; never a Three object. */
export function kartVehiclePose(pose: KartPose) {
  return {
    version: 1 as const,
    position: [pose.x, pose.height ?? 0, pose.z] as const,
    heading: pose.heading,
  };
}

/** Camera framing only. Uses a rendered server pose, never predicts a finish or movement. */
export function kartCameraPose(
  pose: KartPose,
  reduced: boolean,
  boost = 0,
): {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
} {
  const height = kartVehiclePose(pose).position[1];
  const c = Math.cos(pose.heading),
    s = Math.sin(pose.heading);
  const pullback = Math.max(0, Math.min(1, Number.isFinite(boost) ? boost : 0)) * 2;
  return reduced
    ? {
        position: [pose.x, 24 + height, pose.z + 0.01] as const,
        target: [pose.x, height, pose.z] as const,
      }
    : {
        position: [
          pose.x - c * (9 + pullback),
          6 + height,
          pose.z - s * (9 + pullback),
        ] as const,
        target: [pose.x + c * 5, 0.8 + height, pose.z + s * 5] as const,
      };
}

/** Eased cosmetic response to an accepted boost; no local boost expiry/timer. */
export function boostCameraAmount(
  current: number,
  active: boolean,
  delta: number,
  reduced: boolean,
) {
  if (reduced) return 0;
  const from = Math.max(0, Math.min(1, Number.isFinite(current) ? current : 0));
  const dt = Number.isFinite(delta) ? Math.max(0, Math.min(0.1, delta)) : 0;
  return from + ((active ? 1 : 0) - from) * (1 - Math.exp(-8 * dt));
}
/** Visual smoothing only: no prediction, physics, checkpoint or timer authority. */
export function smoothKartPose(
  from: KartPose,
  to: KartPose,
  deltaSeconds: number,
  reduced: boolean,
): KartPose {
  if (!reduced && deltaSeconds <= 0) return { ...from };
  if (reduced || Math.hypot(to.x - from.x, to.z - from.z) > 8) return { ...to };
  const alpha = 1 - Math.exp(-14 * Math.max(0, Math.min(0.1, deltaSeconds)));
  const angle = Math.atan2(
    Math.sin(to.heading - from.heading),
    Math.cos(to.heading - from.heading),
  );
  return {
    x: from.x + (to.x - from.x) * alpha,
    z: from.z + (to.z - from.z) * alpha,
    heading: from.heading + angle * alpha,
    ...(to.height !== undefined || from.height !== undefined
      ? { height: (from.height ?? 0) + ((to.height ?? 0) - (from.height ?? 0)) * alpha }
      : {}),
  };
}
