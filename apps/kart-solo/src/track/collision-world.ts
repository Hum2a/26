import { indexWalls, type Wall } from "@26/shared";
import data from "./colliders.json";

// Generated from the pinned visible geometry by scripts/kart-colliders.mjs.
export const soloWalls: readonly Wall[] = data.edges.map(([ax, az, bx, bz]) => ({
  ax,
  az,
  bx,
  bz,
}));
export const nearbySoloWalls = indexWalls(soloWalls);
