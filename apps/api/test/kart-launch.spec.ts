import { expect, it } from "vitest";
import {
  createKartRace,
  kartLaunchTuning,
  projectKartRace,
  reduceKart,
  type KartRace,
} from "@26/shared";
import { parkTrackId } from "../../../packages/shared/src/kart/kart-park.ts";

function race(launches = true, cpu = 0): KartRace {
  const created = createKartRace("r", [{ playerId: "a", name: "Amina" }], {
    trackId: parkTrackId,
    seedGrid: true,
    cpu,
  });
  if (launches) created.launchVersion = 1;
  return created;
}
function throttle(current: KartRace, at: number, gas = true, sequence = 1) {
  const ticked = reduceKart(current, { type: "tick", elapsedMs: at });
  return reduceKart(ticked, {
    type: "input",
    playerId: "a",
    value: { raceId: "r", sequence, steer: 0, gas, brake: false, drift: false },
  });
}

it("grades the first throttle against GO and boosts perfect and good starts", () => {
  const perfect = throttle(race(), 200).drivers[0]!;
  expect(perfect.launch).toBe("perfect");
  expect(perfect.boostMs).toBe(kartLaunchTuning.perfect.boostMs);
  expect(perfect.physics).toMatchObject({
    boostMs: kartLaunchTuning.perfect.boostMs,
    boostLevel: kartLaunchTuning.perfect.level,
  });
  const good = throttle(race(), 1000).drivers[0]!;
  expect(good.launch).toBe("good");
  expect(good.physics).toMatchObject({ boostLevel: kartLaunchTuning.good.level });
  const late = throttle(race(), 1400).drivers[0]!;
  expect(late.launch).toBe("late");
  expect(late.boostMs).toBe(0);
});

it("times only the first throttle, and only on room races", () => {
  // Steering first does not use up the start; the later throttle is timed.
  let current = throttle(race(), 100, false, 1);
  expect(current.drivers[0]!.launch).toBeUndefined();
  current = throttle(current, 400, true, 2);
  expect(current.drivers[0]!.launch).toBe("perfect");
  // Lifting and pressing again cannot earn a second boost.
  current = throttle(current, 2000, false, 3);
  current = throttle(current, 2200, true, 4);
  expect(current.drivers[0]!.launch).toBe("perfect");
  // Races without the flag (older rooms, practice) never launch.
  expect(throttle(race(false), 200).drivers[0]!.launch).toBeUndefined();
});

it("shows a boosted start only for the opening seconds", () => {
  let current = throttle(race(), 200);
  expect(projectKartRace(current, "a", 0).participants[0]!.launch).toBe("perfect");
  current = reduceKart(current, { type: "tick", elapsedMs: 4200 });
  expect(projectKartRace(current, "a", 0).participants[0]!.launch).toBeUndefined();
  // A late start is never shown.
  expect(
    projectKartRace(throttle(race(), 1500), "a", 0).participants[0]!.launch,
  ).toBeUndefined();
});

it("never gives CPU racers a launch", () => {
  let current = race(true, 2);
  for (let t = 200; t <= 2000; t += 200)
    current = reduceKart(current, { type: "tick", elapsedMs: t });
  for (const cpu of current.drivers.filter((d) => d.cpu))
    expect(cpu.launch).toBeUndefined();
});
