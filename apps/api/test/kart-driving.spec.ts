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
  soloCourse,
  stepCourse,
  ringCourse,
  createKartRace,
  reduceKart,
  projectKartRace,
} from "@26/shared";

it("runs course launch and flight in the authoritative race reducer, only when enabled", () => {
  const ramp = ringCourse.find((f) => f.kind === "ramp")!;
  for (const enabled of [false, true]) {
    let race = createKartRace("flight", [{ playerId: "a", name: "Driver" }]);
    race.courseEnabled = enabled;
    const driver = race.drivers[0]!;
    driver.x = ramp.x - Math.cos(ramp.heading) * 5;
    driver.z = ramp.z - Math.sin(ramp.heading) * 5;
    driver.heading = ramp.heading;
    driver.angle = Math.atan2(driver.z, driver.x);
    driver.physics = {
      ...createDrivingBody(driver.x, driver.z, driver.heading),
      vx: Math.cos(ramp.heading) * 20,
      vz: Math.sin(ramp.heading) * 20,
    };
    race = reduceKart(race, {
      type: "input",
      playerId: "a",
      value: { ...kartNeutral, gas: true, raceId: "flight", sequence: 1 },
    });
    race = reduceKart(race, { type: "tick", elapsedMs: 300 });
    expect((projectKartRace(race, "a", 100).participants[0]!.height ?? 0) > 0).toBe(
      enabled,
    );
    const restored = JSON.parse(JSON.stringify(race)) as typeof race;
    restored.drivers[0]!.physics!.courseMs = 0;
    expect(reduceKart(restored, { type: "tick", elapsedMs: 400 })).toEqual(
      reduceKart(race, { type: "tick", elapsedMs: 400 }),
    );
  }
});

it("lets a floor boost feed straight into a ramp without sharing their cooldowns", () => {
  let body = { ...createDrivingBody(-3, -24, -Math.PI / 2), vz: -20 };
  let boosted = false,
    launched = false;
  for (let t = 0; t < 2000; t += 20) {
    body = stepDriving(
      body,
      { ...kartNeutral, gas: true },
      20,
      soloDriving,
      [],
      false,
      true,
      soloCourse,
    );
    boosted ||= body.trackNotice === "boost";
    launched ||= (body.height ?? 0) > 0;
  }
  expect(boosted).toBe(true);
  expect(launched).toBe(true);
});

it("uses power-limited acceleration without attracting above-limit speed to a target", () => {
  const gas = { ...kartNeutral, gas: true };
  const fast = { ...createDrivingBody(), vx: 45 };
  const driven = stepDriving(fast, gas, 20, soloDriving, []);
  const coast = stepDriving(fast, kartNeutral, 20, soloDriving, []);
  expect(driven.vx).toBeGreaterThan(coast.vx);
  expect(driven.vx).toBeGreaterThan(44.5);
  expect(coast.vx).toBeGreaterThan(44.5);
  const low = stepDriving({ ...fast, vx: 10 }, gas, 20, soloDriving, []).vx - 10;
  const high = stepDriving({ ...fast, vx: 25 }, gas, 20, soloDriving, []).vx - 25;
  expect(low).toBeGreaterThan(high);
  const expired = stepDriving({ ...fast, boostMs: 10 }, gas, 20, soloDriving, []);
  expect(expired.vx).toBe(driven.vx);
});

it("gives each drift tier more thrust as well as more time", () => {
  const releases = [700, 1400, 2400].map((driftMs) =>
    stepDriving(
      { ...createDrivingBody(), vx: 25, driftMs, wasDrifting: true },
      { ...kartNeutral, gas: true },
      20,
      soloDriving,
      [],
    ),
  );
  expect(releases.map((b) => b.boostLevel)).toEqual([1, 2, 3]);
  expect(releases[2]!.vx).toBeGreaterThan(releases[1]!.vx);
  expect(releases[1]!.vx).toBeGreaterThan(releases[0]!.vx);
});

it("sweeps floor boosts and ramps, glides and lands, with finite state and a cooldown", () => {
  const gas = { ...kartNeutral, gas: true };
  for (const feature of soloCourse.filter((f) => f.kind !== "hazard")) {
    const from = {
      ...createDrivingBody(feature.x, feature.z + 8, -Math.PI / 2),
      vz: -30,
    };
    const hit = stepCourse(
      from,
      { ...from, z: feature.z - 8 },
      gas,
      20,
      [feature],
      0.85,
    );
    expect(hit.trackNotice).toBe(feature.kind);
    const repeated = stepCourse(hit, hit, gas, 20, [feature], 0.85);
    expect(repeated.featureCooldowns![feature.id]).toBeLessThan(
      hit.featureCooldowns![feature.id]!,
    );
    if (feature.kind === "boost") expect(hit.boostLevel).toBe(2);
    else {
      expect(hit.verticalSpeed).toBeGreaterThan(0);
      let flight = hit;
      for (let t = 0; t < 5000; t += 20)
        flight = stepDriving(flight, gas, 20, soloDriving, []);
      expect(flight.height).toBe(0);
      expect(flight.verticalSpeed).toBe(0);
      expect(flight.trackNotice).toBe("landed");
    }
  }
});

it("lets airborne karts clear hazards and brake to land sooner; clear course has no pickups", () => {
  const hazard = soloCourse.find((f) => f.kind === "hazard")!;
  const ground = { ...createDrivingBody(hazard.x, hazard.z), vx: 10 };
  const hit = stepCourse(ground, ground, kartNeutral, 20, [hazard], 0.85);
  expect(hit.vx).toBe(4.5);
  expect(stepCourse(ground, ground, kartNeutral, 20, [], 0.85).vx).toBe(10);
  const flight = { ...ground, height: 3, verticalSpeed: 0 };
  const glide = stepCourse(
    flight,
    flight,
    { ...kartNeutral, gas: true },
    20,
    [hazard],
    0.85,
  );
  const dive = stepCourse(
    flight,
    flight,
    { ...kartNeutral, brake: true },
    20,
    [],
    0.85,
  );
  expect(glide.vx).toBe(10);
  expect(glide.height).toBeGreaterThan(dive.height!);
});

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
