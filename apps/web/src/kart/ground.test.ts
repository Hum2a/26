import { expect, it } from "vitest";
import geometry from "../../../../packages/shared/src/kart/kart-circuit.json";
import {
  importedGroundAt,
  importedSurfaceAt,
} from "../../../../packages/shared/src/kart/kart-track";

it("interpolates measured mesh heights and upward normals in each renderer's coordinate space", () => {
  for (const triangle of [geometry.road[0]!, geometry.dirt[0]!]) {
    const x = triangle.reduce((sum, p) => sum + p[0]!, 0) / 3;
    const z = triangle.reduce((sum, p) => sum + p[1]!, 0) / 3;
    const solo = importedGroundAt(x, z, "solo")!;
    const connected = importedGroundAt(x, z, "connected")!;
    expect(solo.y).toBeCloseTo(triangle.reduce((sum, p) => sum + p[2]!, 0) / 3, 2);
    expect(connected.y - solo.y).toBeCloseTo(1.6, 8);
    expect(Math.hypot(...solo.normal)).toBeCloseTo(1, 8);
    expect(solo.normal[1]).toBeGreaterThan(0);
    expect(importedSurfaceAt(x, z)).not.toBe("unsupported");
  }
  expect(importedGroundAt(10000, 10000, "solo")).toBeUndefined();
  expect(importedGroundAt(0, -31, "connected")?.y).toBeCloseTo(0, 1);
});
