import { expect, it } from "vitest";
import {
  createDrivingBody,
  createKartRace,
  kartStandings,
  projectKartRace,
  reduceKart,
  type KartRace,
} from "@26/shared";
import { parkRoute, parkTrackId } from "../../../packages/shared/src/kart/kart-park.ts";

const L = parkRoute.lapLength;
const players = [
  { playerId: "a", name: "Amina" },
  { playerId: "b", name: "Chen" },
];

/** Put a kart on the centreline `along` metres in, moving forward at `speed`. */
function place(
  race: KartRace,
  index: number,
  along: number,
  checkpoint: number,
  speed = 20,
) {
  const pose = parkRoute.point(along);
  const driver = race.drivers[index]!;
  Object.assign(driver, {
    x: pose.x,
    z: pose.z,
    heading: pose.heading,
    angle: along,
    distance: along,
    checkpoint,
    speed,
    physics: {
      ...createDrivingBody(pose.x, pose.z, pose.heading),
      vx: Math.cos(pose.heading) * speed,
      vz: Math.sin(pose.heading) * speed,
    },
  });
}
function hold(race: KartRace, playerId: string, sequence: number) {
  return reduceKart(race, {
    type: "input",
    playerId,
    value: {
      raceId: race.raceId,
      sequence,
      steer: 0,
      gas: true,
      brake: false,
      drift: false,
    },
  });
}
/** Drive to the line, then a little past it. */
function crossLine(race: KartRace, playerId: string, sequence: number) {
  let next = hold(race, playerId, sequence);
  next = reduceKart(next, { type: "tick", elapsedMs: next.elapsedMs + 300 });
  return next;
}

it("counts every lap, keeps lap times and finishes on the last line crossing", () => {
  let race = createKartRace("r", players, { trackId: parkTrackId, laps: 3 });
  expect(race.laps).toBe(3);
  // The race window scales with the laps.
  expect(race.timeLimitMs).toBe(180_000 * 3);
  race = reduceKart(race, { type: "tick", elapsedMs: 20_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 1);
  let a = race.drivers[0]!;
  expect(a.status).toBe("RACING");
  expect(a.checkpoint).toBe(0);
  expect(a.lapTimes).toHaveLength(1);
  expect(a.lapTimes![0]).toBeGreaterThan(20_000);
  let view = projectKartRace(race, "a", 100);
  expect(view.laps).toBe(3);
  expect(view.participants[0]).toMatchObject({ lap: 2, status: "RACING" });
  expect(view.participants[0]!.progress).toBeGreaterThan(1 / 3);
  expect(view.participants[0]!.progress).toBeLessThan(0.4);
  // Second lap.
  race = reduceKart(race, { type: "tick", elapsedMs: 40_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 2);
  expect(race.drivers[0]).toMatchObject({ status: "RACING", lapsDone: 2 });
  expect(projectKartRace(race, "a", 100).participants[0]!.lap).toBe(3);
  // Final lap: the last crossing finishes with the total race time.
  race = reduceKart(race, { type: "tick", elapsedMs: 60_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 3);
  a = race.drivers[0]!;
  expect(a.status).toBe("FINISHED");
  expect(a.lapTimes).toHaveLength(3);
  expect(a.lapTimeMs).toBe(a.lapTimes![2]);
  view = projectKartRace(race, "a", 100);
  expect(view.participants[0]).toMatchObject({ status: "FINISHED", lap: 3 });
  expect(view.participants[0]!.lapsMs).toEqual(a.lapTimes);
});

it("ranks by whole-race progress, so a kart a lap ahead leads", () => {
  let race = createKartRace("r", players, { trackId: parkTrackId, laps: 2 });
  race = reduceKart(race, { type: "tick", elapsedMs: 15_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 1);
  // Chen is near the end of lap one, Amina just started lap two.
  place(race, 1, L - 40, 7);
  race = reduceKart(race, { type: "tick", elapsedMs: race.elapsedMs + 20 });
  const order = kartStandings(race, 0).map((row) => row.playerId);
  expect(order).toEqual(["a", "b"]);
});

it("does not refund or repeat a lap when recovering just after the line", () => {
  let race = createKartRace("r", players, { trackId: parkTrackId, laps: 2 });
  race = reduceKart(race, { type: "tick", elapsedMs: 15_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 1);
  expect(race.drivers[0]!.lapsDone).toBe(1);
  race = reduceKart(race, { type: "recover", playerId: "a" });
  const a = race.drivers[0]!;
  expect(a.lapsDone).toBe(1);
  expect(a.checkpoint).toBe(0);
  expect(a.status).toBe("RACING");
  // Driving on after the recovery does not finish straight away.
  race = hold(race, "a", 2);
  race = reduceKart(race, { type: "tick", elapsedMs: race.elapsedMs + 1000 });
  expect(race.drivers[0]!.status).toBe("RACING");
  expect(race.drivers[0]!.lapsDone).toBe(1);
});

it("keeps one-lap races exactly as before", () => {
  let race = createKartRace("r", players, { trackId: parkTrackId });
  expect(race.laps).toBeUndefined();
  expect(race.timeLimitMs).toBe(180_000);
  race = reduceKart(race, { type: "tick", elapsedMs: 15_000 });
  place(race, 0, L - 3, 7);
  race = crossLine(race, "a", 1);
  expect(race.drivers[0]!.status).toBe("FINISHED");
  const view = projectKartRace(race, "a", 100);
  expect(view.laps).toBeUndefined();
  expect(view.participants[0]!.lap).toBeUndefined();
});

it("gives a following kart the slipstream on a straight", () => {
  let race = createKartRace("r", players, { trackId: parkTrackId });
  race = reduceKart(race, { type: "tick", elapsedMs: 5_000 });
  // Find a straight 60 m long within the first sector.
  let start = 10;
  while (
    Math.abs(
      Math.atan2(
        Math.sin(parkRoute.point(start + 60).heading - parkRoute.point(start).heading),
        Math.cos(parkRoute.point(start + 60).heading - parkRoute.point(start).heading),
      ),
    ) > 0.03
  )
    start += 2;
  expect(start).toBeLessThan(L - 60);
  const gate = (along: number) => Math.floor(along / (L / 8));
  // Chen 7 m behind Amina at the same speed.
  place(race, 0, start + 7, gate(start + 7), 22);
  place(race, 1, start, gate(start), 22);
  race = hold(race, "a", 1);
  race = hold(race, "b", 1);
  let phases: (string | undefined)[] = [];
  for (let i = 0; i < 8; i++) {
    race = hold(race, "a", 2 + i);
    race = hold(race, "b", 2 + i);
    race = reduceKart(race, { type: "tick", elapsedMs: race.elapsedMs + 200 });
    phases.push(projectKartRace(race, "b", 0).participants[1]!.slipstream);
  }
  expect(phases).toContain("charging");
  expect(phases).toContain("active");
  // The leader has nobody to draft.
  expect(projectKartRace(race, "a", 0).participants[0]!.slipstream).toBeUndefined();
  phases = [];
});
