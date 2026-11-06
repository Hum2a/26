import { expect, it } from "vitest";
import { kartNeutral } from "@26/shared";
import {
  controlSteering,
  kartControlPreferences,
  mapKartGamepad,
  readKartGamepad,
} from "./gamepad";
import { testPad } from "./controls.test-support";
it("smooths the deadzone, preserves full lock and bounds invalid axes and preferences", () => {
  expect(mapKartGamepad(testPad(0.14)).controls.steer).toBe(0);
  expect(mapKartGamepad(testPad(-0.14)).controls).toEqual(kartNeutral);
  expect(mapKartGamepad(testPad(0.151)).controls.steer).toBeLessThan(0.002);
  expect(mapKartGamepad(testPad(1), { sensitivity: 0.5 }).controls.steer).toBe(1);
  expect(mapKartGamepad(testPad(-50)).controls.steer).toBe(-1);
  expect(mapKartGamepad(testPad(NaN)).controls.steer).toBe(0);
  expect(kartControlPreferences({ sensitivity: Infinity, deadzone: -10 })).toEqual({
    sensitivity: 1,
    deadzone: 0.05,
  });
  expect(controlSteering(0.5, 0.5)).toBe(0.25);
  expect(controlSteering(0.5, 1.5)).toBeGreaterThan(0.5);
  expect(controlSteering(Infinity)).toBe(0);
});
it("retains the practice A/B/RB/RT mapping and adds X item and Y recovery intents", () => {
  const frame = mapKartGamepad(testPad(0, [0, 1, 2, 3, 5]));
  expect(frame).toMatchObject({
    controls: { gas: true, brake: true, drift: true },
    item: true,
    recover: true,
  });
  expect(mapKartGamepad(testPad(0, [7])).controls.drift).toBe(true);
  expect(mapKartGamepad({ ...testPad(1, [0]), connected: false })).toMatchObject({
    index: null,
    controls: kartNeutral,
    item: false,
    recover: false,
  });
  expect(mapKartGamepad(null).controls).toEqual(kartNeutral);
});
it("handles sparse controller slots and API refusal without throwing or retaining input", () => {
  expect(
    readKartGamepad({}, () => [null, testPad(1, [0], 2) as Gamepad]),
  ).toMatchObject({ index: 2, controls: { steer: 1, gas: true } });
  expect(
    readKartGamepad({}, () => {
      throw new DOMException("Blocked", "SecurityError");
    }),
  ).toMatchObject({ available: false, index: null, controls: kartNeutral });
});
