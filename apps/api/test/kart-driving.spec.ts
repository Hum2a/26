import { expect, it } from "vitest";
import {
  createDrivingBody,
  moveWithWalls,
  stepDriving,
  soloDriving,
  kartNeutral,
  ringWalls,
  ringDriving,
  drivingDriftLevel,
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

const driveDrift = (steer = 0.4, duration = 1000) => {
  let body = { ...createDrivingBody(), vx: soloDriving.maxSpeed };
  for (let t = 0; t < duration; t += 20)
    body = stepDriving(
      body,
      { gas: true, brake: false, drift: true, steer },
      20,
      soloDriving,
      [],
    );
  return body;
};
it("banks charge through neutral and counter-steering, then boosts on release", () => {
  const charged = driveDrift();
  for (const steer of [0, -0.7]) {
    const held = stepDriving(
      charged,
      { gas: true, brake: false, drift: true, steer },
      20,
      soloDriving,
      [],
    );
    expect(held.wasDrifting).toBe(true);
    expect(held.driftSide).toBe(1);
    expect(held.driftMs).toBeGreaterThan(charged.driftMs);
    const released = stepDriving(
      held,
      { ...kartNeutral, gas: true },
      20,
      soloDriving,
      [],
    );
    expect(released.boostMs).toBe(580);
    expect(Math.hypot(released.vx, released.vz)).toBeGreaterThan(
      Math.hypot(held.vx, held.vz),
    );
  }
});
it("rewards three charge tiers, without stacking or boosting off-road", () => {
  expect([699, 700, 1400, 2400].map(drivingDriftLevel)).toEqual([0, 1, 2, 3]);
  for (const [driftMs, boostMs] of [
    [699, 0],
    [700, 580],
    [1400, 880],
    [2400, 1180],
  ]) {
    const body = {
      ...createDrivingBody(),
      vx: 25,
      wasDrifting: true,
      driftMs: driftMs!,
    };
    expect(
      stepDriving(body, { ...kartNeutral, gas: true }, 20, soloDriving, []).boostMs,
    ).toBe(boostMs);
    expect(
      stepDriving(body, { ...kartNeutral, gas: true }, 20, soloDriving, [], true)
        .boostMs,
    ).toBe(0);
  }
});
it("slides symmetrically, tightens with inward steering and recovers grip on exit", () => {
  const left = driveDrift(-0.5),
    right = driveDrift(0.5);
  expect(left.x).toBeCloseTo(right.x);
  expect(left.z).toBeCloseTo(-right.z);
  const slip = (b: typeof right) =>
    Math.abs(-Math.sin(b.heading) * b.vx + Math.cos(b.heading) * b.vz);
  expect(slip(right)).toBeGreaterThan(3);
  const tight = stepDriving(
    right,
    { gas: true, brake: false, drift: true, steer: 1 },
    20,
    soloDriving,
    [],
  );
  const wide = stepDriving(
    right,
    { gas: true, brake: false, drift: true, steer: -1 },
    20,
    soloDriving,
    [],
  );
  expect(tight.turn).toBeGreaterThan(wide.turn);
  let exit = right;
  for (let t = 0; t < 300; t += 20)
    exit = stepDriving(exit, { ...kartNeutral, gas: true }, 20, soloDriving, []);
  expect(slip(exit)).toBeLessThan(slip(right));
});

it("cancels a drift on stale input, braking, dirt and impact without cashing charge", () => {
  const body = { ...driveDrift(), x: 4.1, z: 0, heading: 0, vx: 25, vz: 0 };
  const held = { gas: true, brake: false, drift: true, steer: 0 };
  for (const next of [
    stepDriving(body, held, 20, soloDriving, [], false, false),
    stepDriving(body, { ...held, brake: true }, 20, soloDriving, []),
    stepDriving(body, held, 20, soloDriving, [], true),
    stepDriving(body, held, 20, soloDriving, wall),
  ]) {
    expect(next.wasDrifting).toBe(false);
    expect(next.driftMs).toBe(0);
    expect(next.boostMs).toBe(0);
  }
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
