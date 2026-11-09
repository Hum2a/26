import { createKartRoute } from "./kart-route.ts";
import { indexWalls, type Wall } from "./kart-driving.ts";
import type { CourseFeature } from "./kart-course.ts";
import type { ItemBox } from "./kart-powers.ts";

/** Original 26 Park: sweeping 40m bends, wide straights and a gentle S section.
 * Geometry, road edge and walls have one source; no imported track/model asset. */
export const parkTrackId = "26-park-v1" as const;
export const parkRoadHalfWidth = 12;
function centreline(): readonly (readonly [number, number])[] {
  const points: [number, number][] = [
    [0, 0],
    [0, -60],
  ];
  const arc = (x: number, z: number, start: number) => {
    for (let i = 1; i <= 12; i++) {
      const angle = start + ((i / 12) * Math.PI) / 2;
      points.push([x + 40 * Math.cos(angle), z + 40 * Math.sin(angle)]);
    }
  };
  arc(40, -60, Math.PI);
  points.push([120, -100]);
  arc(120, -60, -Math.PI / 2);
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    points.push([160 + 10 * Math.sin(t * Math.PI * 2), -60 + 120 * t]);
  }
  arc(120, 60, 0);
  points.push([40, 100]);
  arc(40, 60, Math.PI / 2);
  points.push([0, 0]);
  return points;
}
export const parkRoute = createKartRoute(centreline());
/** Mitered strip shared verbatim by mesh, map, road classification and wall segments. */
export const parkRibbon = parkRoute.points.slice(0, -1).map((point, i, points) => {
  const previous = points[(i + points.length - 1) % points.length]!,
    next = points[(i + 1) % points.length]!;
  const normal = (a: readonly number[], b: readonly number[]) => {
    const x = b[0]! - a[0]!,
      z = b[1]! - a[1]!,
      length = Math.hypot(x, z);
    return [-z / length, x / length] as const;
  };
  const before = normal(previous, point),
    after = normal(point, next);
  const length = Math.hypot(before[0] + after[0], before[1] + after[1]);
  const nx = (before[0] + after[0]) / length,
    nz = (before[1] + after[1]) / length;
  const width = parkRoadHalfWidth / (nx * after[0] + nz * after[1]);
  return {
    left: [point[0] + nx * width, point[1] + nz * width] as const,
    right: [point[0] - nx * width, point[1] - nz * width] as const,
  };
});
export const parkWalls: readonly Wall[] = parkRibbon.flatMap((edge, i) => {
  const next = parkRibbon[(i + 1) % parkRibbon.length]!;
  return (["left", "right"] as const).map((side) => ({
    ax: edge[side][0],
    az: edge[side][1],
    bx: next[side][0],
    bz: next[side][1],
  }));
});
export const nearbyParkWalls = indexWalls(parkWalls);
function inside(points: readonly (readonly [number, number])[], x: number, z: number) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
const left = parkRibbon.map((p) => p.left),
  right = parkRibbon.map((p) => p.right);
export const parkSurfaceAt = (x: number, z: number): "road" | "dirt" =>
  inside(left, x, z) !== inside(right, x, z) ? "road" : "dirt";
export function parkLanePoint(along: number, lateral = 0) {
  const pose = parkRoute.point(along);
  return {
    x: pose.x - Math.sin(pose.heading) * lateral,
    z: pose.z + Math.cos(pose.heading) * lateral,
    heading: pose.heading,
  };
}
export const parkItemBoxes: readonly ItemBox[] = Array.from(
  { length: 6 },
  (_, station) =>
    [-4, 0, 4].map((lane, i) => {
      const { x, z } = parkLanePoint(
        50 + (station * (parkRoute.lapLength - 70)) / 6,
        lane,
      );
      return { id: `park-${station}-${i}`, x, z };
    }),
).flat();
export const parkCourse: readonly CourseFeature[] = (
  ["boost", "ramp", "hazard"] as const
).map((kind, i) => ({
  id: `park-${kind}`,
  kind,
  ...parkLanePoint(parkRoute.lapLength * [0.18, 0.4, 0.7][i]!, i === 1 ? -4 : 4),
  width: 3,
  length: 5,
}));
