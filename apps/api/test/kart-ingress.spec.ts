import { expect, it, vi } from "vitest";
import {
  KartIngressCache,
  type KartIngressClock,
} from "../src/room/kart/kart-ingress.ts";
const clock: KartIngressClock = {
  phase: "collect",
  paused: 0,
  hold: null,
  phase_generation: 3,
  scope_generation: 1,
  question_index: 0,
  question_set_version: "kart-v1",
};

it("loads the frozen roster once without admitting late guests or stale races", () => {
  const gate = new KartIngressCache();
  const load = vi.fn(() => ({ raceId: "race-one", players: ["amina"] }));
  for (let i = 0; i < 800; i++)
    expect(gate.allows(clock, "amina", "race-one", load)).toBe(true);
  expect(load).toHaveBeenCalledTimes(1);
  expect(gate.allows(clock, "late", "race-one", load)).toBe(false);
  expect(gate.allows(clock, "amina", "old-race", load)).toBe(false);
});
it.each([
  { phase: "reveal" },
  { paused: 1 },
  { hold: "controller" },
  { hold: "stage" },
])("refuses a stopped phase and reloads after resuming: %j", (stopped) => {
  const gate = new KartIngressCache();
  const load = vi.fn(() => ({ raceId: "race-one", players: ["amina"] }));
  expect(gate.allows(clock, "amina", "race-one", load)).toBe(true);
  expect(gate.allows({ ...clock, ...stopped }, "amina", "race-one", load)).toBe(false);
  expect(load).toHaveBeenCalledTimes(1);
  expect(gate.allows(clock, "amina", "race-one", load)).toBe(true);
  expect(load).toHaveBeenCalledTimes(2);
});
it.each([
  { scope_generation: 2 },
  { phase_generation: 4 },
  { question_index: 1 },
  { question_set_version: "kart-v2" },
])("replaces stale eligibility when the durable scope changes: %j", (changed) => {
  const gate = new KartIngressCache();
  const load = vi
    .fn()
    .mockReturnValueOnce({ raceId: "old", players: ["amina"] })
    .mockReturnValue({ raceId: "new", players: ["bilal"] });
  expect(gate.allows(clock, "amina", "old", load)).toBe(true);
  expect(gate.allows({ ...clock, ...changed }, "amina", "old", load)).toBe(false);
  expect(gate.allows({ ...clock, ...changed }, "bilal", "new", load)).toBe(true);
  expect(load).toHaveBeenCalledTimes(2);
});
it("rejects non-kart phases and starts cold after eviction", () => {
  const load = vi.fn(() => undefined);
  expect(new KartIngressCache().allows(clock, "amina", "race", load)).toBe(false);
  const roster = () => ({ raceId: "race", players: ["bilal"] });
  expect(new KartIngressCache().allows(clock, "amina", "race", roster)).toBe(false);
  expect(new KartIngressCache().allows(clock, "bilal", "race", roster)).toBe(true);
});

it("reads the clock only on cold ingress and refreshes it at durable boundaries", () => {
  const gate = new KartIngressCache();
  const load = vi.fn(() => clock);
  for (let i = 0; i < 800; i++) expect(gate.readClock(load)).toEqual(clock);
  expect(load).toHaveBeenCalledTimes(1);
  const paused = { ...clock, paused: 1 };
  gate.refreshClock(paused);
  expect(gate.readClock(load)).toEqual(paused);
  expect(load).toHaveBeenCalledTimes(1);
  gate.refreshClock(undefined);
  expect(gate.readClock(load)).toEqual(clock);
  expect(load).toHaveBeenCalledTimes(2);
});
