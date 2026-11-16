import { expect, it } from "vitest";
import {
  createKartTrial,
  stepKartTrial,
  recoverKartTrial,
  kartTrialRecord,
  kartTrialQuality,
  type KartTrial,
  type KartTrialConfig,
} from "@26/shared";
import { importedRoute } from "../../../packages/shared/src/kart/kart-route.ts";
const config: KartTrialConfig = {
  version: 1,
  track: "mario-circuit-v1",
  physics: "arcade-v2",
  handling: "slide-v1",
  laps: 1,
  assists: "none",
  items: false,
  course: { boosts: false, ramps: false, hazards: false },
};
function move(state: KartTrial, x: number, z: number) {
  return stepKartTrial(state, {
    x,
    z,
    speed: 50,
    stepMs: 20,
    activeMs: state.observedMs + 20,
  });
}
function start(state: KartTrial) {
  for (let z = 7; z >= 0; z--) state = move(state, 0, z);
  return state;
}
function lap(state: KartTrial) {
  for (let segment = 1; segment < importedRoute.length; segment++) {
    const a = importedRoute[segment - 1]!,
      b = importedRoute[segment]!;
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 1; i <= steps; i++)
      state = move(
        state,
        a[0] + ((b[0] - a[0]) * i) / steps,
        a[1] + ((b[1] - a[1]) * i) / steps,
      );
  }
  return state;
}
it.each([1, 3] as const)(
  "times %i actual ordered laps, freezes the finish and emits only valid practice records",
  (laps) => {
    let state = start(createKartTrial({ ...config, laps }));
    expect(state.startedMs).toBe(160);
    expect(state.elapsedMs).toBe(0);
    for (let i = 0; i < laps; i++) {
      state = lap(state);
      expect(state.laps).toHaveLength(i + 1);
    }
    expect(state.finished).toBe(true);
    expect(state.laps.every((l) => l.sectorsMs.length === 8)).toBe(true);
    expect(
      state.laps.every((l) => l.sectorsMs.reduce((sum, n) => sum + n, 0) === l.timeMs),
    ).toBe(true);
    expect(kartTrialRecord(state)).toMatchObject({
      quality: "clean",
      totalMs: state.elapsedMs,
      config: { laps },
    });
    expect(move(state, 0, -1)).toBe(state);
  },
);
it("waits for a forward start, ignores reverse crossing and freezes when no active tick is accepted", () => {
  let state = createKartTrial(config);
  state = move(state, 0, 9);
  expect(state.startedMs).toBeNull();
  expect(kartTrialRecord(state)).toBeUndefined();
  expect(
    stepKartTrial(state, {
      x: 0,
      z: -1,
      speed: 50,
      stepMs: 20,
      activeMs: state.observedMs,
    }),
  ).toBe(state);
  state = move(state, 0, 8);
  state = start(state);
  expect(state.startedMs).not.toBeNull();
  expect(state.elapsedMs).toBe(0);
  const saved = JSON.parse(JSON.stringify(state));
  expect(move(saved, 0, -1)).toEqual(move(state, 0, -1));
});
it("invalidates a teleport and never records an invalid completed lap", () => {
  let state = start(createKartTrial(config));
  state = move(state, 200, -125);
  expect(state.quality).toBe("invalid");
  expect(state.cursor.checkpoint).toBe(0);
  state = move(state, 0, 0);
  state = lap(state);
  expect(state.finished).toBe(true);
  expect(kartTrialQuality(state)).toBe("invalid");
  expect(kartTrialRecord(state)).toBeUndefined();
  expect(createKartTrial(config).quality).toBe("clean");
});
it("restores the saved cursor and separates assisted records, retaining elapsed recovery time", () => {
  let state = start(createKartTrial(config));
  const cursor = { ...state.cursor };
  state = move(state, 0, -1);
  const recovered = recoverKartTrial(state, cursor);
  expect(recovered.elapsedMs).toBe(20);
  expect(recovered.cursor).toEqual(cursor);
  expect(recovered.quality).toBe("assisted");
  const finished = lap(recovered);
  expect(kartTrialRecord(finished)?.quality).toBe("assisted");
  expect(recoverKartTrial(finished, cursor)).toBe(finished);
  expect(recoverKartTrial(createKartTrial(config), cursor).quality).toBe("clean");
});
it("copies and validates the frozen run settings", () => {
  const input = { ...config, course: { ...config.course } };
  const state = createKartTrial(input);
  input.course.boosts = true;
  expect(state.config.course.boosts).toBe(false);
  expect(() =>
    createKartTrial({ ...config, laps: 2 } as unknown as KartTrialConfig),
  ).toThrow();
});
