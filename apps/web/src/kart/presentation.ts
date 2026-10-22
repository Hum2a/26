import type { KartDriver } from "@26/shared";

export type KartPose = Pick<KartDriver, "x" | "z" | "heading" | "height">;

/** Camera framing only. Uses a rendered server pose, never predicts a finish or movement. */
export function kartCameraPose(
  pose: KartPose,
  reduced: boolean,
): {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
} {
  const height = pose.height ?? 0;
  const c = Math.cos(pose.heading),
    s = Math.sin(pose.heading);
  return reduced
    ? {
        position: [pose.x, 24 + height, pose.z + 0.01] as const,
        target: [pose.x, height, pose.z] as const,
      }
    : {
        position: [pose.x - c * 9, 6 + height, pose.z - s * 9] as const,
        target: [pose.x + c * 5, 0.8 + height, pose.z + s * 5] as const,
      };
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
