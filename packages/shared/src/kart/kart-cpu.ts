/**
 * CPU racers: karts the room drives itself, so a small party still gets a
 * full grid. Each one follows the course's own route by aiming at a point a
 * little ahead of it, lifts off for tight bends and holds a personal top speed
 * (its skill). Pure and deterministic: the same race replays identically.
 * CPU karts take places on the track but never score.
 */
import type { KartControls, KartTrackId } from "./kart-race-schema.ts";
import { parkRoute, parkTrackId } from "./kart-park.ts";
import {
  importedTrackId,
  importedTrackPoint,
  importedTrackProgress,
} from "./kart-route.ts";

export const kartCpuMax = 7;
export const kartCpuNames = [
  "CPU Turbo Tess",
  "CPU Drift Dev",
  "CPU Mini Max",
  "CPU Bonnie Boost",
  "CPU Captain Kerb",
  "CPU Lappy",
  "CPU Ziggy Zoom",
] as const;

/** Spread from steady to sharp, so the CPU field strings out like a real race. */
export function kartCpuSkill(index: number): number {
  return [0.84, 0.95, 0.88, 0.92, 0.8, 0.9, 0.86][index % 7]!;
}

export const kartCpuPlayerId = (index: number) => `cpu-${index + 1}`;
export const isKartCpuId = (playerId: string) => /^cpu-\d+$/.test(playerId);

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const ringRadius = 42;

/** Where this kart should aim: a point on the route `ahead` metres on. */
function aimPoint(trackId: KartTrackId, x: number, z: number, ahead: number) {
  if (trackId === importedTrackId) {
    const here = importedTrackProgress(x, z);
    return importedTrackPoint(here.along + ahead);
  }
  if (trackId === parkTrackId) {
    const here = parkRoute.progress(x, z);
    return parkRoute.point(here.along + ahead);
  }
  // The legacy ring runs anticlockwise round a 42 m centre line.
  const angle = Math.atan2(z, x) + ahead / ringRadius;
  return { x: Math.cos(angle) * ringRadius, z: Math.sin(angle) * ringRadius };
}

export function kartCpuInput(
  kart: { x: number; z: number; heading: number; speed: number },
  trackId: KartTrackId,
  skill: number,
  elapsedMs: number,
  index: number,
): KartControls {
  const ring = trackId !== importedTrackId && trackId !== parkTrackId;
  const top = (ring ? 12 : 30) * skill;
  const speed = Number.isFinite(kart.speed) ? kart.speed : 0;
  const target = aimPoint(
    trackId,
    kart.x,
    kart.z,
    (ring ? 6 : 9) + Math.max(0, speed) * 0.55,
  );
  const error = wrap(Math.atan2(target.z - kart.z, target.x - kart.x) - kart.heading);
  // A small personal wobble so CPU karts do not drive in a perfect line.
  const wobble = Math.sin(elapsedMs / 650 + index * 1.7) * 0.06 * (1.1 - skill);
  const steer = Math.max(-1, Math.min(1, error * 2.4 + wobble));
  const sharp = Math.abs(error);
  return {
    steer: Number.isFinite(steer) ? Math.round(steer * 100) / 100 : 0,
    // Lift for a tight bend or at its own top speed; brake only when badly off line.
    gas: speed < top && !(sharp > 0.55 && speed > top * 0.55),
    brake: sharp > 1.1 && speed > top * 0.4,
    drift: false,
  };
}
