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
