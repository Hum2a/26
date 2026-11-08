import { expect, it } from "vitest";
import {
  createDrivingBody,
  createKartRace,
  kartStandings,
  projectKartRace,
  reduceKart,
  type KartRace,
} from "@26/shared";
import {
  isKartCpuId,
  kartCpuInput,
  kartCpuNames,
} from "../../../packages/shared/src/kart-cpu.ts";
import { parkRoute, parkTrackId } from "../../../packages/shared/src/kart-park.ts";
import { importedTrackId } from "../../../packages/shared/src/kart-route.ts";

const guest = [{ playerId: "a", name: "Amina" }];

it("aims along the route: straight ahead is gas, a kart facing the wrong way turns and lifts", () => {
  const pose = parkRoute.point(60);
  const ahead = kartCpuInput(
    { x: pose.x, z: pose.z, heading: pose.heading, speed: 10 },
    parkTrackId,
    0.9,
    0,
    1,
  );
  expect(ahead.gas).toBe(true);
  expect(Math.abs(ahead.steer)).toBeLessThan(0.5);
  const wrong = kartCpuInput(
    { x: pose.x, z: pose.z, heading: pose.heading + Math.PI / 2, speed: 25 },
    parkTrackId,
    0.9,
    0,
    1,
  );
  expect(Math.abs(wrong.steer)).toBe(1);
  expect(wrong.gas).toBe(false);
  // Its own top speed is a ceiling: no throttle above it.
  expect(
    kartCpuInput(
      { x: pose.x, z: pose.z, heading: pose.heading, speed: 29 },
      parkTrackId,
      0.8,
      0,
      1,
    ).gas,
  ).toBe(false);
  // Bad numbers never escape as controls.
  const odd = kartCpuInput(
    { x: pose.x, z: pose.z, heading: 0, speed: Number.NaN },
    parkTrackId,
    0.9,
    0,
    1,
  );
  expect(Number.isFinite(odd.steer)).toBe(true);
});

it("adds CPU racers behind the guests, within limits", () => {
  const race = createKartRace("r", guest, {
    trackId: parkTrackId,
    seedGrid: true,
    cpu: 3,
  });
  expect(race.drivers.map((d) => d.playerId)).toEqual(["a", "cpu-1", "cpu-2", "cpu-3"]);
  expect(race.drivers.slice(1).every((d) => d.cpu && isKartCpuId(d.playerId))).toBe(
    true,
  );
  expect(race.drivers[1]!.name).toBe(kartCpuNames[0]);
  expect(race.drivers[0]!.gridPosition).toBe(1);
  expect(() => createKartRace("r", guest, { cpu: 8 })).toThrow();
  expect(() => createKartRace("r", guest, { cpu: 1.5 })).toThrow();
  expect(() =>
    createKartRace("r", [{ playerId: "cpu-1", name: "Sneaky" }], { cpu: 1 }),
  ).toThrow();
  const view = projectKartRace(race, "a", 100);
  expect(view.participants.filter((d) => d.cpu)).toHaveLength(3);
  expect(view.participants[0]!.cpu).toBeUndefined();
});

function drive(
  trackId: typeof parkTrackId | typeof importedTrackId | "party-ring-v1",
  ms: number,
) {
  let race = createKartRace("r", guest, { trackId, seedGrid: true, cpu: 2 });
  for (let t = 200; t <= ms; t += 200)
    race = reduceKart(race, { type: "tick", elapsedMs: t });
  return race;
}

for (const [trackId, ms, minimum] of [
  [parkTrackId, 30_000, 0.5],
  // A circuit lap is long: 40 s reached 34.99%, so give it 60 s for the same bar.
  [importedTrackId, 60_000, 0.35],
  ["party-ring-v1", 20_000, 0.35],
] as const)
  it(`CPU racers lap the ${trackId} course on their own, deterministically`, () => {
    const race = drive(trackId, ms);
    const cpus = race.drivers.filter((d) => d.cpu);
    for (const cpu of cpus) expect(cpu.progress).toBeGreaterThan(minimum);
    // The guest never touched the controls and stayed on the grid.
    expect(race.drivers[0]!.progress).toBe(0);
    expect(drive(trackId, ms).drivers.map((d) => [d.x, d.z])).toEqual(
      race.drivers.map((d) => [d.x, d.z]),
    );
  });

it("ends the race when the guests are done and shares points by guest rank only", () => {
  let race: KartRace = createKartRace(
    "r",
    [...guest, { playerId: "b", name: "Chen" }],
    {
      trackId: parkTrackId,
      seedGrid: true,
      cpu: 2,
    },
  );
  race = reduceKart(race, { type: "tick", elapsedMs: 10_000 });
  // A CPU finished first; then both guests finish.
  Object.assign(race.drivers[2]!, { status: "FINISHED", lapTimeMs: 9_000 });
  Object.assign(race.drivers[0]!, { status: "FINISHED", lapTimeMs: 9_500 });
  let table = kartStandings(race, 100);
  expect(table[0]).toMatchObject({ playerId: "cpu-1", place: 1, points: 0, cpu: true });
  // Amina is second on the track but the best guest, so she gets the full points.
  expect(table[1]).toMatchObject({ playerId: "a", place: 2, points: 100 });
  expect(race.ended).toBe(false);
  // Chen is still racing; when he stops, the race ends although a CPU is still going.
  Object.assign(race.drivers[1]!, { status: "FINISHED", lapTimeMs: 9_800 });
  race = reduceKart(race, { type: "tick", elapsedMs: 10_200 });
  expect(race.ended).toBe(true);
  expect(race.drivers[3]!.status).toBe("DNF");
  table = kartStandings(race, 100);
  expect(table.find((r) => r.playerId === "b")).toMatchObject({ points: 50 });
});

it("never hands a CPU racer an item", () => {
  let race = createKartRace("r", guest, {
    trackId: parkTrackId,
    seedGrid: true,
    cpu: 2,
    itemRules: { version: 1 },
  });
  for (let t = 200; t <= 30_000; t += 200)
    race = reduceKart(race, { type: "tick", elapsedMs: t });
  for (const cpu of race.drivers.filter((d) => d.cpu)) {
    expect(cpu.power?.item ?? null).toBeNull();
    expect(cpu.power?.collections ?? 0).toBe(0);
  }
});

it("puts a CPU kart stuck against a barrier back on its last safe point", () => {
  let race = createKartRace("r", guest, {
    trackId: parkTrackId,
    seedGrid: true,
    cpu: 1,
  });
  race = reduceKart(race, { type: "tick", elapsedMs: 2_000 });
  const cpu = race.drivers[1]!;
  const safe = { ...cpu.lastSafe! };
  // Far from its safe point, at a standstill, and already still for 2.4 s:
  // the state a kart pinned against a barrier is in.
  Object.assign(cpu, {
    x: safe.x + 200,
    z: safe.z + 200,
    speed: 0,
    stuckMs: 2_400,
    physics: createDrivingBody(safe.x + 200, safe.z + 200, 0),
  });
  race = reduceKart(race, { type: "tick", elapsedMs: 2_200 });
  const moved = race.drivers[1]!;
  expect(Math.hypot(moved.x - safe.x, moved.z - safe.z)).toBeLessThan(10);
  expect(moved.stuckMs ?? 0).toBeLessThan(2_500);
  // A CPU kart that is moving never counts as stuck.
  race = reduceKart(race, { type: "tick", elapsedMs: 6_000 });
  expect(race.drivers[1]!.stuckMs ?? 0).toBe(0);
});
