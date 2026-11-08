import { expect, it } from "vitest";
import {
  inWake,
  slipstreamPhase,
  slipstreamTuning,
  stepSlipstream,
  type SlipstreamKart,
} from "../../../packages/shared/src/kart-slipstream.ts";

const kart = (patch: Partial<SlipstreamKart> = {}): SlipstreamKart => ({
  playerId: "me",
  x: 0,
  z: 0,
  heading: 0,
  speed: 25,
  ...patch,
});

it("finds a wake only close behind a kart going the same way at speed", () => {
  const me = kart();
  expect(inWake(me, kart({ playerId: "a", x: 8 }))).toBe(true);
  expect(inWake(me, kart({ playerId: "a", x: 8, z: 2.5 }))).toBe(true);
  // Beside, too far, behind, wide, turned or slow: no wake.
  expect(inWake(me, kart({ playerId: "a", x: 1 }))).toBe(false);
  expect(inWake(me, kart({ playerId: "a", x: 30 }))).toBe(false);
  expect(inWake(me, kart({ playerId: "a", x: -8 }))).toBe(false);
  expect(inWake(me, kart({ playerId: "a", x: 8, z: 4 }))).toBe(false);
  expect(inWake(me, kart({ playerId: "a", x: 8, heading: Math.PI / 2 }))).toBe(false);
  expect(inWake(me, kart({ playerId: "a", x: 8, speed: 5 }))).toBe(false);
  expect(inWake(kart({ speed: 5 }), kart({ playerId: "a", x: 8 }))).toBe(false);
  // Never your own wake.
  expect(inWake(me, kart({ x: 8 }))).toBe(false);
});

it("charges in a wake, triggers once, runs out and bleeds when the wake is lost", () => {
  const me = kart(),
    leader = [kart({ playerId: "a", x: 8 })];
  let state = { draftMs: 0, slipstreamMs: 0 };
  for (let t = 0; t < slipstreamTuning.chargeMs - 20; t += 20)
    state = stepSlipstream(state, me, leader, 20);
  expect(slipstreamPhase(state)).toBe("charging");
  expect(state.slipstreamMs).toBe(0);
  state = stepSlipstream(state, me, leader, 20);
  expect(state).toEqual({ draftMs: 0, slipstreamMs: slipstreamTuning.bonusMs });
  expect(slipstreamPhase(state)).toBe("active");
  // While active the draft cannot re-charge, even in the wake.
  state = stepSlipstream(state, me, leader, 600);
  expect(state).toEqual({ draftMs: 0, slipstreamMs: slipstreamTuning.bonusMs - 600 });
  state = stepSlipstream(state, me, leader, 5000);
  expect(state.slipstreamMs).toBe(0);
  // Out of the wake the charge drains twice as fast as it built.
  state = { draftMs: 600, slipstreamMs: 0 };
  state = stepSlipstream(state, me, [], 100);
  expect(state.draftMs).toBe(400);
  expect(stepSlipstream(state, me, [], 1000).draftMs).toBe(0);
  expect(slipstreamPhase({ draftMs: 100, slipstreamMs: 0 })).toBeUndefined();
  // Bad steps change nothing.
  expect(stepSlipstream(state, me, leader, NaN)).toBe(state);
});
