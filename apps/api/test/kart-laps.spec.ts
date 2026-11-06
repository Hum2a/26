import { expect, it } from "vitest";
import { advanceKartLap, type KartLapCursor } from "@26/shared";
import {
  importedLapLength,
  importedRoute,
  importedTrackProgress,
  importedTrackPoint,
} from "../../../packages/shared/src/kart-route.ts";

const start: KartLapCursor = { angle: 0, distance: 0, checkpoint: 0 };
it("samples public navigation markers at the same eight ordered circuit gates", () => {
  for (let sector = 1; sector < 8; sector++) {
    const along = (sector * importedLapLength) / 8;
    const point = importedTrackPoint(along);
    const projected = importedTrackProgress(point.x, point.z);
    expect(projected.distance).toBeCloseTo(0, 8);
    expect(projected.along).toBeCloseTo(along, 8);
    expect(point.heading).toBeCloseTo(projected.heading, 8);
  }
  expect(importedTrackPoint(importedLapLength)).toEqual(importedTrackPoint(0));
  expect(importedTrackPoint(-4)).toEqual(importedTrackPoint(importedLapLength - 4));
  expect(() => importedTrackPoint(Infinity)).toThrow(RangeError);
});
function at(cursor: KartLapCursor, along: number, routeDistance = 0) {
  return advanceKartLap(cursor, {
    along,
    lapLength: 800,
    speed: 50,
    stepMs: 20,
    routeDistance,
  });
}

it("requires every ordered forward gate, then a physical finish crossing", () => {
  let cursor = start;
  for (let along = 1; along < 800; along++) {
    const next = at(cursor, along);
    expect(next.finished).toBe(false);
    expect(next.checkpoint).toBe(Math.floor(along / 100));
    cursor = next;
  }
  expect(at(cursor, 0)).toMatchObject({
    checkpoint: 8,
    distance: 800,
    progress: 1,
    finished: true,
  });
  expect(start).toEqual({ angle: 0, distance: 0, checkpoint: 0 });
});

it("does not count reverse line crossings or oscillating start-line travel", () => {
  let cursor = start;
  for (let i = 0; i < 80; i++) {
    const reverse = at(cursor, 799);
    expect(reverse).toMatchObject({
      checkpoint: 0,
      distance: -1,
      progress: 0,
      finished: false,
    });
    cursor = at(reverse, 1);
    expect(cursor).toMatchObject({ checkpoint: 0, distance: 1 });
  }
});

it("rejects teleporting past a gate and small loops beyond that missed gate", () => {
  let cursor: KartLapCursor = { angle: 98, distance: 98, checkpoint: 0 };
  cursor = at(cursor, 140);
  expect(cursor).toMatchObject({ distance: 98, checkpoint: 0, safeProgress: false });
  for (const along of [141, 139, 142, 140, 138]) {
    cursor = at(cursor, along);
    expect(cursor).toMatchObject({ distance: 98, checkpoint: 0, safeProgress: false });
  }
  // Only physically returning to the missed gate can earn it.
  cursor = at(cursor, 99);
  expect(at(cursor, 101)).toMatchObject({
    distance: 101,
    checkpoint: 1,
    safeProgress: true,
  });
});

it("rejects off-route crossings and large jumps despite favourable velocity", () => {
  const before = { angle: 99, distance: 99, checkpoint: 0 };
  expect(at(before, 101, 20.01)).toMatchObject({
    checkpoint: 0,
    distance: 99,
    safeProgress: false,
  });
  expect(at(before, 101, 20)).toMatchObject({
    checkpoint: 1,
    distance: 101,
    safeProgress: true,
  });
  expect(at(before, 299)).toMatchObject({
    checkpoint: 0,
    distance: 99,
    safeProgress: false,
  });
});

it("retains the original legacy ring accumulation and negative-distance bound", () => {
  const ring = (cursor: KartLapCursor, along: number) =>
    advanceKartLap(cursor, { along, lapLength: Math.PI * 2, speed: 11, stepMs: 20 });
  let cursor = start;
  // Cross the line, rather than stopping within floating-point rounding of it.
  for (let i = 1; i <= 641; i++) {
    const angle = i * ((Math.PI * 2) / 640);
    cursor = ring(cursor, Math.atan2(Math.sin(angle), Math.cos(angle)));
  }
  expect(cursor).toMatchObject({ checkpoint: 8, finished: true, progress: 1 });
  cursor = start;
  for (let i = 1; i <= 1300; i++) cursor = ring(cursor, -i / 100);
  expect(cursor.distance).toBeGreaterThanOrEqual(-Math.PI * 2);
  expect(cursor.checkpoint).toBe(0);
});

it("validates the real baked circuit route and survives serialisation mid-lap", () => {
  let cursor = start;
  for (let segment = 1; segment < importedRoute.length; segment++) {
    const a = importedRoute[segment - 1]!,
      b = importedRoute[segment]!;
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 1; i <= steps; i++) {
      const projection = importedTrackProgress(
        a[0] + ((b[0] - a[0]) * i) / steps,
        a[1] + ((b[1] - a[1]) * i) / steps,
      );
      cursor = advanceKartLap(cursor, {
        along: projection.along,
        routeDistance: projection.distance,
        lapLength: importedLapLength,
        speed: 50,
        stepMs: 20,
      });
      if (segment === 20 && i === 1) cursor = JSON.parse(JSON.stringify(cursor));
    }
  }
  expect(cursor).toMatchObject({ checkpoint: 8, finished: true, progress: 1 });
});

it("restores a legitimate recovery cursor without fabricating a new gate", () => {
  const safe = { angle: 210, distance: 210, checkpoint: 2 };
  let cursor: KartLapCursor = at(safe, 600);
  expect(cursor).toMatchObject({ checkpoint: 2, distance: 210, finished: false });
  cursor = { ...safe };
  expect(at(cursor, 211)).toMatchObject({
    checkpoint: 2,
    distance: 211,
    finished: false,
  });
  expect(safe).toEqual({ angle: 210, distance: 210, checkpoint: 2 });
});
