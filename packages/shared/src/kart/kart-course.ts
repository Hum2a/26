import type { DrivingBody, DrivingInput } from "./kart-driving.ts";

export type CourseFeature = {
  id: string;
  kind: "boost" | "ramp" | "hazard";
  x: number;
  z: number;
  heading: number;
  width: number;
  length: number;
};
export type CourseSettings = { boosts: boolean; ramps: boolean; hazards: boolean };
export const defaultCourseSettings: CourseSettings = {
  boosts: true,
  ramps: true,
  hazards: true,
};
export const clearCourseSettings: CourseSettings = {
  boosts: false,
  ramps: false,
  hazards: false,
};
export const courseEnabled = (f: CourseFeature, s: CourseSettings) =>
  f.kind === "boost" ? s.boosts : f.kind === "ramp" ? s.ramps : s.hazards;

// The imported circuit's opening straight has room for optional side lanes.
// Centre remains clear for existing straight-line drift rehearsals.
export const soloCourse: readonly CourseFeature[] = [
  {
    id: "launch-pad",
    kind: "boost",
    x: -3,
    z: -28,
    heading: -Math.PI / 2,
    width: 2.8,
    length: 5,
  },
  {
    id: "glide-ramp",
    kind: "ramp",
    x: -3,
    z: -48,
    heading: -Math.PI / 2,
    width: 2.8,
    length: 5,
  },
  {
    id: "sweeper",
    kind: "hazard",
    x: 3,
    z: -68,
    heading: -Math.PI / 2,
    width: 2.2,
    length: 3,
  },
];
export const ringCourse: readonly CourseFeature[] = [
  ["boost", Math.PI / 3, 39],
  ["ramp", Math.PI, 42],
  ["hazard", Math.PI * 1.5, 46],
].map(([kind, angle, radius], i) => ({
  id: `ring-feature-${i}`,
  kind: kind as CourseFeature["kind"],
  x: Math.cos(angle as number) * (radius as number),
  z: Math.sin(angle as number) * (radius as number),
  heading: (angle as number) + Math.PI / 2,
  width: 3,
  length: 4,
}));

/** Moving hazard position is a pure function of active simulation time. */
export function courseFeaturePose(feature: CourseFeature, nowMs: number) {
  const offset = feature.kind === "hazard" ? Math.sin(nowMs / 900) * 1.5 : 0;
  return {
    x: feature.x - Math.sin(feature.heading) * offset,
    z: feature.z + Math.cos(feature.heading) * offset,
  };
}

function intersects(
  from: DrivingBody,
  to: DrivingBody,
  feature: CourseFeature,
  radius: number,
  now: number,
) {
  const pose = courseFeaturePose(feature, now),
    c = Math.cos(feature.heading),
    s = Math.sin(feature.heading);
  const ax = (from.x - pose.x) * c + (from.z - pose.z) * s;
  const az = -(from.x - pose.x) * s + (from.z - pose.z) * c;
  const dx = (to.x - from.x) * c + (to.z - from.z) * s;
  const dz = -(to.x - from.x) * s + (to.z - from.z) * c;
  let lo = 0,
    hi = 1;
  for (const [p, v, extent] of [
    [ax, dx, feature.length / 2 + radius],
    [az, dz, feature.width / 2 + radius],
  ]) {
    if (Math.abs(v!) < 1e-9) {
      if (Math.abs(p!) > extent!) return false;
    } else {
      const a = (-extent! - p!) / v!,
        b = (extent! - p!) / v!;
      lo = Math.max(lo, Math.min(a, b));
      hi = Math.min(hi, Math.max(a, b));
    }
  }
  return lo <= hi;
}

/** Height and effects live in the same durable body as velocity; no wall-clock timers. */
export function stepCourse(
  from: DrivingBody,
  to: DrivingBody,
  input: DrivingInput,
  ms: number,
  features: readonly CourseFeature[],
  radius: number,
): DrivingBody {
  const next = { ...to },
    dt = ms / 1000;
  next.courseMs = (from.courseMs ?? 0) + ms;
  const cooldowns: Record<string, number> = {};
  for (const [id, remaining] of Object.entries(from.featureCooldowns ?? {}))
    if (remaining > ms) cooldowns[id] = remaining - ms;
  next.featureCooldowns = cooldowns;
  next.height = from.height ?? 0;
  next.verticalSpeed = from.verticalSpeed ?? 0;
  if (next.height > 0) {
    // Hold accelerator to deploy the glider; brake folds it for a quicker landing.
    next.verticalSpeed -= (input.gas && !input.brake ? 3.8 : 12) * dt;
    next.height = Math.max(0, next.height + next.verticalSpeed * dt);
    if (!next.height) {
      next.verticalSpeed = 0;
      next.trackNotice = "landed";
    }
  }
  if (next.contact && next.height > 0) {
    next.height = 0;
    next.verticalSpeed = 0;
    next.trackNotice = "landed";
  }
  if (next.height > 0 || next.contact) return next;
  for (const feature of features) {
    if ((cooldowns[feature.id] ?? 0) > 0) continue;
    if (!intersects(from, next, feature, radius, next.courseMs)) continue;
    const speed =
      next.vx * Math.cos(feature.heading) + next.vz * Math.sin(feature.heading);
    if (feature.kind !== "hazard" && (speed < 3 || !input.gas || input.brake)) continue;
    cooldowns[feature.id] = feature.kind === "hazard" ? 1500 : 1000;
    next.trackNotice = feature.kind;
    if (feature.kind === "boost") {
      next.boostMs = Math.max(next.boostMs, 900);
      next.boostLevel = Math.max(next.boostLevel ?? 0, 2);
    }
    if (feature.kind === "ramp") {
      next.height = 0.05;
      next.verticalSpeed = Math.min(6, 2 + speed * 0.1);
      next.driftMs = 0;
      next.wasDrifting = false;
      next.driftSide = 0;
    }
    if (feature.kind === "hazard") {
      next.vx *= 0.45;
      next.vz *= 0.45;
      next.boostMs = 0;
      next.driftMs = 0;
      next.wasDrifting = false;
      next.driftSide = 0;
    }
    break;
  }
  return next;
}
