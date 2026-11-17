import { describe, expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  ringCourse,
  type KartRaceView,
  createDrivingBody,
  parkTrackId,
  reduceKart,
} from "@26/shared";
import { createSelfPrediction } from "./self-prediction";

const gas = { steer: 0, gas: true, brake: false, drift: false };
const idle = { steer: 0, gas: false, brake: false, drift: false };
it("uses the same original park driving environment for cosmetic prediction and accepted movement", () => {
  const state = createKartRace("park-prediction", [{ playerId: "a", name: "Amina" }], {
    trackId: parkTrackId,
  });
  const view = projectKartRace(state, "a", 0);
  // Compare identical initial poses: public headings are intentionally milliradian-rounded.
  state.drivers[0]!.heading = view.participants[0]!.heading;
  const prediction = createSelfPrediction();
  prediction.input(gas, 0);
  prediction.server(view, 0, 0);
  const accepted = reduceKart(
    reduceKart(state, {
      type: "input",
      playerId: "a",
      value: { ...gas, raceId: state.raceId, sequence: 1 },
    }),
    { type: "tick", elapsedMs: 200 },
  );
  const pose = prediction.pose(200)!;
  expect(pose.x).toBeCloseTo(accepted.drivers[0]!.x, 5);
  expect(pose.z).toBeCloseTo(accepted.drivers[0]!.z, 5);
});

it("seeds optional bounce stun/cooldown from accepted self metadata and resumes responsive prediction afterwards", () => {
  const state = createKartRace("bounce-predict", [{ playerId: "a", name: "Amina" }], {
    handling: "bounce-v1",
  });
  state.elapsedMs = 1000;
  const driver = state.drivers[0]!;
  driver.physics = {
    ...createDrivingBody(driver.x, driver.z, driver.heading),
    stunMs: 180,
    impactCooldownMs: 600,
  };
  const view = projectKartRace(state, "a", 0);
  const prediction = createSelfPrediction();
  prediction.input(gas, 1000);
  prediction.server(view, 1000, 0);
  const first = prediction.pose(1000)!;
  const waiting = prediction.pose(1100)!;
  expect(waiting.x).toBe(first.x);
  expect(waiting.z).toBe(first.z);
  expect(prediction.pose(1250)!.speed).toBeGreaterThan(0);
});

function race(elapsedMs = 1_000): KartRaceView {
  const state = createKartRace("predict", [
    { playerId: "a", name: "Amina" },
    { playerId: "b", name: "Chen" },
  ]);
  state.elapsedMs = elapsedMs;
  return projectKartRace(state, "a", 0);
}

function self(view: KartRaceView) {
  return view.participants.find((driver) => driver.playerId === "a")!;
}

describe("self prediction", () => {
  it("draws nothing until a server frame anchors it", () => {
    const prediction = createSelfPrediction();
    prediction.input(gas, 0);
    expect(prediction.pose(100)).toBeUndefined();
  });

  it("moves the kart on the next frame after the pedal, before the room replies", () => {
    const prediction = createSelfPrediction();
    const view = race();
    prediction.server(view, 1_000, 100);
    const start = prediction.pose(1_000)!;
    prediction.input(gas, 1_000);
    const later = prediction.pose(1_300)!;
    expect(later.speed).toBeGreaterThan(0.5);
    const moved = Math.hypot(later.x - start.x, later.z - start.z);
    expect(moved).toBeGreaterThan(0.05);
    // Idle controls keep a stationary kart where the room put it.
    const still = createSelfPrediction();
    still.input(idle, 900);
    still.server(view, 1_000, 100);
    const parked = still.pose(1_300)!;
    expect(parked.x).toBeCloseTo(self(view).x, 3);
    expect(parked.z).toBeCloseTo(self(view).z, 3);
  });

  it("turns with the steering before any server confirmation", () => {
    const straight = createSelfPrediction();
    const turning = createSelfPrediction();
    const view = race();
    for (const prediction of [straight, turning]) {
      prediction.input(gas, 0);
      prediction.server(view, 1_000, 0);
    }
    turning.input({ ...gas, steer: 1 }, 1_000);
    straight.pose(2_000);
    turning.pose(2_000);
    const a = straight.pose(2_016)!,
      b = turning.pose(2_016)!;
    expect(Math.abs(b.heading - a.heading)).toBeGreaterThan(0.05);
  });

  it("eases a small server correction instead of snapping, then settles on it", () => {
    const prediction = createSelfPrediction();
    const first = race(1_000);
    prediction.server(first, 1_000, 0);
    const before = prediction.pose(1_200)!;
    const corrected = race(1_200);
    self(corrected).x += 2;
    prediction.server(corrected, 1_200, 0);
    const immediately = prediction.pose(1_200)!;
    expect(immediately.x).toBeCloseTo(before.x, 3);
    const settled = prediction.pose(1_700)!;
    expect(settled.x).toBeCloseTo(self(corrected).x, 1);
  });

  it("snaps to the room when the phone is far out", () => {
    const prediction = createSelfPrediction();
    prediction.server(race(1_000), 1_000, 0);
    prediction.pose(1_200);
    const moved = race(1_200);
    self(moved).x += 20;
    prediction.server(moved, 1_200, 0);
    expect(prediction.pose(1_200)!.x).toBeCloseTo(self(moved).x, 3);
  });

  it("ignores a repeated frame and stops predicting once the racer finishes", () => {
    const prediction = createSelfPrediction();
    const view = race(1_000);
    prediction.server(view, 1_000, 0);
    prediction.input(gas, 1_000);
    const a = prediction.pose(1_200)!;
    prediction.server(view, 1_200, 0);
    const b = prediction.pose(1_200)!;
    expect(b.x).toBeCloseTo(a.x, 6);
    const finished = race(1_400);
    self(finished).status = "FINISHED";
    prediction.server(finished, 1_400, 0);
    expect(prediction.pose(1_500)).toBeUndefined();
  });

  it("never extrapolates beyond a bounded span when frames stop", () => {
    const prediction = createSelfPrediction();
    prediction.input(gas, 0);
    prediction.server(race(1_000), 1_000, 0);
    const start = prediction.pose(1_000)!;
    const stalled = prediction.pose(60_000)!;
    // At most 600 ms of travel, not a minute.
    expect(Math.hypot(stalled.x - start.x, stalled.z - start.z)).toBeLessThan(10);
  });

  it.each([
    ["on", 600],
    ["on-conservative", 300],
  ] as const)(
    "freezes %s prediction after stale frames, even while rendering every 16 ms",
    (mode, spanMs) => {
      const prediction = createSelfPrediction();
      const view = race();
      prediction.configure(mode);
      prediction.input(gas, 0);
      prediction.server(view, 1_000, 0);
      for (let now = 1_016; now < 1_000 + spanMs; now += 16) {
        prediction.server(view, now, 0);
        prediction.pose(now);
      }
      const stopped = prediction.pose(1_000 + spanMs)!;
      expect(stopped.speed).toBeGreaterThan(0);
      for (let now = 1_000 + spanMs + 16; now < 11_000; now += 16) {
        prediction.server(view, now, 0);
        expect(prediction.pose(now)).toEqual(stopped);
      }
      // New controls cannot extend the age of the last room frame either.
      prediction.input({ ...gas, steer: 1 }, 11_000);
      prediction.server(view, 11_000, 0);
      expect(prediction.pose(11_000)).toEqual(stopped);
    },
  );

  it("resumes from a fresh room frame after prediction has frozen", () => {
    const prediction = createSelfPrediction();
    prediction.input(gas, 0);
    prediction.server(race(), 1_000, 0);
    const stopped = prediction.pose(1_600)!;
    prediction.pose(10_000);
    const fresh = race(1_200);
    Object.assign(self(fresh), stopped);
    prediction.server(fresh, 10_000, 0);
    const resumed = prediction.pose(10_000)!;
    expect(resumed.x).toBeCloseTo(stopped.x, 6);
    expect(resumed.z).toBeCloseTo(stopped.z, 6);
    const moving = prediction.pose(10_200)!;
    expect(Math.hypot(moving.x - resumed.x, moving.z - resumed.z)).toBeGreaterThan(
      0.05,
    );
  });

  it.each([false, true])(
    "refreshes course features when a same-tick host change replaces enabled=%s",
    (initiallyEnabled) => {
      const boost = ringCourse.find((feature) => feature.kind === "boost")!;
      const initial = race();
      initial.courseEnabled = initiallyEnabled;
      Object.assign(self(initial), {
        x: boost.x,
        z: boost.z,
        heading: boost.heading,
        speed: 12,
      });
      const changed = { ...initial, courseEnabled: !initiallyEnabled };
      const switched = createSelfPrediction();
      const reference = createSelfPrediction();
      const unchanged = createSelfPrediction();
      for (const prediction of [switched, reference, unchanged])
        prediction.input(gas, 0);
      switched.server(initial, 1_000, 0);
      switched.server(changed, 1_000, 0);
      reference.server(changed, 1_000, 0);
      unchanged.server(initial, 1_000, 0);
      expect(switched.pose(1_200)).toEqual(reference.pose(1_200));
      expect(
        Math.abs(switched.pose(1_200)!.speed - unchanged.pose(1_200)!.speed),
      ).toBeGreaterThan(0.5);
    },
  );

  it("conservative mode extrapolates less after frames stop", () => {
    const standard = createSelfPrediction();
    const conservative = createSelfPrediction();
    conservative.configure("on-conservative");
    for (const prediction of [standard, conservative]) {
      prediction.input(gas, 0);
      prediction.server(race(1_000), 1_000, 0);
      prediction.pose(1_000);
    }
    const a = standard.pose(60_000)!,
      b = conservative.pose(60_000)!;
    const start = self(race(1_000));
    expect(Math.hypot(b.x - start.x, b.z - start.z)).toBeLessThan(
      Math.hypot(a.x - start.x, a.z - start.z),
    );
  });

  it("keeps a pedal held before the race's first frame", () => {
    const prediction = createSelfPrediction();
    prediction.input(gas, 500);
    prediction.server(race(1_000), 1_000, 0);
    const start = prediction.pose(1_000)!;
    const later = prediction.pose(1_400)!;
    expect(Math.hypot(later.x - start.x, later.z - start.z)).toBeGreaterThan(0.05);
  });
});

function deviceFrame(elapsed = 1000, revision = 1): KartRaceView {
  const view = race(elapsed);
  const d = self(view);
  return {
    ...view,
    timingMode: "device-v1",
    rollback: {
      revision,
      appliedSequence: 0,
      recovery: 0,
      body: createDrivingBody(d.x, d.z, d.heading),
      lap: {
        angle: Math.atan2(d.z, d.x),
        distance: 0,
        checkpoint: 0,
        done: 0,
        splits: [],
      },
      input: idle,
    },
  };
}
it("replays unprocessed controls from exact velocity, rejects stale checkpoints, and keeps driving beyond one missing tick", () => {
  const p = createSelfPrediction(),
    frame = deviceFrame();
  frame.rollback!.body.vx = 4;
  frame.rollback!.body.vz = 3;
  p.running(true, 0);
  p.server(frame, 0, 0);
  p.published({ ...gas, raceId: frame.raceId, sequence: 1 }, 0);
  const before = p.pose(200)!;
  const correction = deviceFrame(1100, 2);
  correction.rollback!.body = { ...frame.rollback!.body };
  p.server(correction, 200, 0);
  const corrected = p.pose(500)!;
  expect(corrected.speed).toBeGreaterThan(0);
  p.server(deviceFrame(1000, 1), 500, 0);
  expect(p.pose(500)).toEqual(corrected);
  const later = p.pose(1500)!;
  expect(Math.hypot(later.x - before.x, later.z - before.z)).toBeGreaterThan(1);
});
it("excludes host pauses, discards pre-recovery controls, and bounds suspension catchup", () => {
  const p = createSelfPrediction(),
    frame = deviceFrame();
  p.running(true, 0);
  p.server(frame, 0, 0);
  p.input(gas, 0);
  p.pose(200);
  p.running(false, 200);
  const paused = p.pose(10000);
  expect(p.pose(20000)).toEqual(paused);
  p.running(true, 20000);
  expect(p.pose(20200)!.speed).toBeGreaterThan(0);
  const recovered = deviceFrame(1400, 3);
  recovered.rollback!.recovery = 1;
  recovered.rollback!.body.x = 100;
  p.server(recovered, 20200, 0);
  expect(p.pose(20200)!.x).toBe(100);
  const beforeSuspension = p.pose(20200)!;
  const afterSuspension = p.pose(60000)!;
  expect(afterSuspension.x).toBe(beforeSuspension.x);
  expect(afterSuspension.z).toBe(beforeSuspension.z);
});
it("freezes one local finish duration and resets it for a replacement race", () => {
  const p = createSelfPrediction(),
    frame = deviceFrame();
  frame.rollback!.body = { ...createDrivingBody(43, -0.04, Math.PI / 2), vz: 10 };
  frame.rollback!.lap = {
    angle: -0.001,
    distance: Math.PI * 2 - 0.001,
    checkpoint: 7,
    done: 0,
    splits: [],
  };
  p.running(true, 0);
  p.server(frame, 0, 0);
  p.pose(20);
  const finish = p.finish();
  expect(finish).toEqual({ raceId: frame.raceId, elapsedMs: 1020, lapsMs: [1020] });
  p.pose(2000);
  expect(p.finish()).toBe(finish);
  p.server({ ...deviceFrame(), raceId: "replacement" }, 3000, 0);
  expect(p.finish()).toBeUndefined();
});

it("measures a finish in active monotonic time across a long host pause", () => {
  const p = createSelfPrediction(),
    frame = deviceFrame();
  frame.rollback!.body = { ...createDrivingBody(43, -0.04, Math.PI / 2), vz: 10 };
  frame.rollback!.lap = {
    angle: -0.001,
    distance: Math.PI * 2 - 0.001,
    checkpoint: 7,
    done: 0,
    splits: [],
  };
  p.running(true, 0);
  p.server(frame, 0, 0);
  p.running(false, 0);
  p.pose(10000);
  expect(p.finish()).toBeUndefined();
  p.running(true, 10000);
  p.pose(10020);
  expect(p.finish()!.elapsedMs).toBe(1020);
});

it("applies a recovery checkpoint before replay can invent a finish from the old position", () => {
  const p = createSelfPrediction(), frame = deviceFrame();
  frame.rollback!.body = { ...createDrivingBody(43, -.04, Math.PI / 2), vz: 10 };
  frame.rollback!.lap = { angle: -.001, distance: Math.PI * 2 - .001, checkpoint: 7, done: 0, splits: [] };
  p.running(true, 0); p.server(frame, 0, 0);
  const recovery = deviceFrame(1020, 2); recovery.rollback!.recovery = 1; recovery.rollback!.body.x = 100;
  p.server(recovery, 20, 0);
  expect(p.finish()).toBeUndefined();
  expect(p.pose(20)!.x).toBe(100);
});
