import { describe, expect, it } from "vitest";
import { createKartRace, projectKartRace, type KartRaceView } from "@26/shared";
import { createSelfPrediction } from "./self-prediction";

const gas = { steer: 0, gas: true, brake: false, drift: false };
const idle = { steer: 0, gas: false, brake: false, drift: false };

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
