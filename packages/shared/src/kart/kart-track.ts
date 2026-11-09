import geometry from "./kart-circuit.json" with { type: "json" };
import { indexWalls, type Wall } from "./kart-driving.ts";

export * from "./kart-route.ts";
export const importedWalls: readonly Wall[] = /* @__PURE__ */ geometry.edges.map(
  ([ax, az, bx, bz]) => ({ ax: ax!, az: az!, bx: bx!, bz: bz! }),
);
let wallIndex: ReturnType<typeof indexWalls> | undefined;
export function nearbyImportedWalls(x: number, z: number, reach: number) {
  wallIndex ??= indexWalls(importedWalls);
  return wallIndex(x, z, reach);
}
type Triangle = number[][];
let surfaces: Map<string, { triangle: Triangle; road: boolean }[]> | undefined;
function surfaceIndex() {
  if (surfaces) return surfaces;
  surfaces = new Map();
  for (const [triangles, road] of [
    [geometry.road, true],
    [geometry.dirt, false],
  ] as const)
    for (const triangle of triangles) {
      const xs = triangle.map((p) => p[0]!),
        zs = triangle.map((p) => p[1]!);
      for (
        let x = Math.floor(Math.min(...xs) / 8);
        x <= Math.floor(Math.max(...xs) / 8);
        x++
      )
        for (
          let z = Math.floor(Math.min(...zs) / 8);
          z <= Math.floor(Math.max(...zs) / 8);
          z++
        ) {
          const key = `${x}:${z}`,
            cell = surfaces.get(key) ?? [];
          cell.push({ triangle, road });
          surfaces.set(key, cell);
        }
    }
  return surfaces;
}
export function importedSurfaceAt(
  x: number,
  z: number,
): "road" | "dirt" | "unsupported" {
  // The visible chequered start-grid strip is a separate GLB mesh, bridging Object_24's seam.
  if (x >= -12 && x <= 14 && z >= -34 && z <= -28) return "road";
  let dirt = false;
  for (const {
    triangle: [a, b, c],
    road,
  } of surfaceIndex().get(`${Math.floor(x / 8)}:${Math.floor(z / 8)}`) ?? []) {
    const cross = (p: number[], q: number[]) =>
      (q[0]! - p[0]!) * (z - p[1]!) - (q[1]! - p[1]!) * (x - p[0]!);
    const v = [cross(a!, b!), cross(b!, c!), cross(c!, a!)];
    if (v.every((n) => n >= -0.001) || v.every((n) => n <= 0.001)) {
      if (road) return "road";
      dirt = true;
    }
  }
  return dirt ? "dirt" : "unsupported";
}

/** Visual ground only: the same baked triangles/index, no collision or scoring change.
 * The solo model is translated 1.6m below the connected model.
 */
export function importedGroundAt(x: number, z: number, space: "solo" | "connected") {
  const offset = space === "connected" ? 1.6 : 0;
  let dirt: { y: number; normal: [number, number, number] } | undefined;
  for (const {
    triangle: [a, b, c],
    road,
  } of surfaceIndex().get(`${Math.floor(x / 8)}:${Math.floor(z / 8)}`) ?? []) {
    if (!a || !b || !c) continue;
    const ux = b[0]! - a[0]!,
      uz = b[1]! - a[1]!,
      uy = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!,
      vz = c[1]! - a[1]!,
      vy = c[2]! - a[2]!;
    const det = ux * vz - uz * vx;
    if (Math.abs(det) < 1e-8) continue;
    const tx = x - a[0]!,
      tz = z - a[1]!;
    const u = (tx * vz - tz * vx) / det,
      v = (ux * tz - uz * tx) / det;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    const nx = uz * vy - uy * vz,
      ny = det,
      nz = uy * vx - ux * vy;
    const sign = ny < 0 ? -1 : 1,
      length = Math.hypot(nx, ny, nz);
    const ground = {
      y: a[2]! + u * uy + v * vy + offset,
      normal: [(nx * sign) / length, (ny * sign) / length, (nz * sign) / length] as [
        number,
        number,
        number,
      ],
    };
    if (road) return ground;
    dirt = ground;
  }
  if (dirt) return dirt;
  // Existing start-grid seam has no road triangle. Explicit flat visual fallback,
  // matching its existing surface bridge; not claimed as measured mesh height.
  if (x >= -12 && x <= 14 && z >= -34 && z <= -28)
    return { y: -1.6 + offset, normal: [0, 1, 0] as [number, number, number] };
  return undefined;
}
