export const importedTrackId = "mario-circuit-v1" as const;
export const importedTrackLimitMs = 180_000;
/** Centreline verified against the pinned GLB road. Used for ordered progress and the broadcast map. */
export const importedRoute: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -100],
  [8, -123],
  [23, -139],
  [48, -143],
  [67, -139],
  [85, -124],
  [100, -95],
  [111, -76],
  [125, -69],
  [175, -69],
  [185, -75],
  [194, -103],
  [205, -124],
  [225, -138],
  [250, -139],
  [274, -130],
  [291, -112],
  [300, -89],
  [297, -68],
  [284, -51],
  [260, -40],
  [220, -31],
  [180, -23],
  [140, -15],
  [114, -8],
  [106, -3],
  [104, 9],
  [109, 18],
  [121, 28],
  [145, 30],
  [255, 30],
  [280, 35],
  [296, 48],
  [303, 65],
  [301, 90],
  [292, 107],
  [278, 116],
  [255, 120],
  [216, 120],
  [207, 115],
  [199, 89],
  [190, 85],
  [143, 85],
  [128, 98],
  [107, 117],
  [82, 130],
  [60, 135],
  [37, 134],
  [20, 127],
  [12, 110],
  [1, 74],
  [0, 0],
];
/** Static closed route geometry shared by course definitions; progress is awarded by kart-laps. */
export function createKartRoute(points: readonly (readonly [number, number])[]) {
  if (
    points.length < 4 ||
    points.some((p) => p.some((n) => !Number.isFinite(n))) ||
    points[0]![0] !== points.at(-1)![0] ||
    points[0]![1] !== points.at(-1)![1]
  )
    throw new RangeError("A route needs a finite closed polyline");
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  if (lengths.some((length) => length <= 0))
    throw new RangeError("Route segments must have length");
  const offsets = lengths.reduce<number[]>(
    (all, value) => [...all, all.at(-1)! + value],
    [0],
  );
  const lapLength = offsets.at(-1)!;
  /** Public centreline geometry for navigation only; does not award progress. */
  function point(along: number) {
    if (!Number.isFinite(along)) throw new RangeError("Route distance must be finite");
    const wrapped = ((along % lapLength) + lapLength) % lapLength;
    const index = lengths.findIndex((length, i) => wrapped < offsets[i]! + length);
    const a = points[index]!,
      b = points[index + 1]!;
    const t = (wrapped - offsets[index]!) / lengths[index]!;
    return {
      x: a[0] + (b[0] - a[0]) * t,
      z: a[1] + (b[1] - a[1]) * t,
      heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
    };
  }
  function progress(x: number, z: number) {
    let best = { distance: Infinity, along: 0, heading: -Math.PI / 2, x: 0, z: 0 };
    for (let i = 0; i < lengths.length; i++) {
      const a = points[i]!,
        b = points[i + 1]!,
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengths[i]! ** 2),
      );
      const px = a[0] + dx * t,
        pz = a[1] + dz * t,
        distance = Math.hypot(x - px, z - pz);
      if (distance < best.distance)
        best = {
          distance,
          along: offsets[i]! + lengths[i]! * t,
          heading: Math.atan2(dz, dx),
          x: px,
          z: pz,
        };
    }
    return best;
  }
  return { points, lapLength, point, progress };
}
const importedGeometry = createKartRoute(importedRoute);
export const importedLapLength = importedGeometry.lapLength;
export const importedTrackPoint = importedGeometry.point;
export const importedTrackProgress = importedGeometry.progress;
