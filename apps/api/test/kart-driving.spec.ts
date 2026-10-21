import { expect, it } from "vitest";
import {
  createDrivingBody,
  moveWithWalls,
  stepDriving,
  soloDriving,
  kartNeutral,
  ringWalls,
  ringDriving,
} from "@26/shared";

const wall = [{ ax: 5, az: -20, bx: 5, bz: 20 }];
it("sweeps through a boost-speed movement without tunnelling and slides along a wall", () => {
  const body = { ...createDrivingBody(), vx: 100, vz: 10 };
  const next = moveWithWalls(body, 0.1, wall, 0.8);
  expect(next.x).toBeLessThan(4.201);
  expect(next.x).toBeGreaterThan(4.19);
  expect(next.z).toBeGreaterThan(0.9);
  expect(next.vx).toBe(0);
  expect(body.x).toBe(0);
});
it("stops in corners and can reverse away without sticking", () => {
  const walls = [...wall, { ax: -20, az: 5, bx: 20, bz: 5 }];
  const next = moveWithWalls(
    { ...createDrivingBody(), vx: 100, vz: 100 },
    0.1,
    walls,
    0.8,
  );
  expect(next.x).toBeLessThan(4.201);
  expect(next.z).toBeLessThan(4.201);
  const away = moveWithWalls({ ...next, vx: -5, vz: -5 }, 0.1, walls, 0.8);
  expect(away.x).toBeLessThan(next.x);
  expect(away.z).toBeLessThan(next.z);
});
it("brakes before reversing, slows off-road and cannot spin while stationary", () => {
  const body = { ...createDrivingBody(), vx: 20 };
  const braking = stepDriving(
    body,
    { ...kartNeutral, brake: true },
    20,
    soloDriving,
    [],
  );
  expect(braking.vx).toBeGreaterThan(0);
  expect(braking.vx).toBeLessThan(20);
  const gas = { ...kartNeutral, gas: true };
  expect(stepDriving(body, gas, 20, soloDriving, [], true).vx).toBeLessThan(
    stepDriving(body, gas, 20, soloDriving, []).vx,
  );
  expect(
    stepDriving(createDrivingBody(), { ...kartNeutral, steer: 1 }, 20, soloDriving, [])
      .heading,
  ).toBe(0);
});
it("blocks either ring boundary at the body's radius", () => {
  for (const [x, vx, low, high] of [
    [48, 100, 48, 49.201],
    [36, -100, 34.79, 36],
  ]) {
    const next = moveWithWalls(
      { ...createDrivingBody(x), vx },
      0.1,
      ringWalls,
      ringDriving.radius,
    );
    expect(next.x).toBeGreaterThan(low);
    expect(next.x).toBeLessThan(high);
  }
});

it("only cashes a charged drift on a deliberate fresh throttle-held release", () => {
  const body = { ...createDrivingBody(), vx: 20, wasDrifting: true, driftMs: 900 };
  const release = { ...kartNeutral, gas: true };
  expect(stepDriving(body, release, 20, soloDriving, []).boostMs).toBeGreaterThan(0);
  expect(stepDriving(body, release, 20, soloDriving, [], false, false).boostMs).toBe(0);
  expect(
    stepDriving(body, { ...release, brake: true }, 20, soloDriving, []).boostMs,
  ).toBe(0);
  expect(stepDriving(body, kartNeutral, 20, soloDriving, []).boostMs).toBe(0);
});
