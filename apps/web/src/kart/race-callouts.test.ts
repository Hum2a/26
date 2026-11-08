import { expect, it } from "vitest";
import type { KartRaceView } from "@26/shared";
import { ordinal, selfCues, stageCallouts } from "./race-callouts";

type Row = { id: string; place: number; lap?: number; status?: "RACING" | "FINISHED" };
function view(rows: Row[], patch: Partial<KartRaceView> = {}): KartRaceView {
  return {
    raceId: "race",
    laps: 3,
    elapsedMs: 10_000,
    selfPlayerId: "b",
    participants: rows.map((row) => ({
      playerId: row.id,
      name: row.id.toUpperCase(),
      status: row.status ?? "RACING",
      lap: row.lap ?? 1,
    })),
    leaderboard: rows.map((row) => ({ playerId: row.id, place: row.place })),
    ...patch,
  } as unknown as KartRaceView;
}

it("writes British ordinals, including the teens", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
    "23rd",
    "101st",
    "111th",
  ]);
});

it("announces lead changes once the grid has settled, and the leader's laps", () => {
  const before = view([
    { id: "a", place: 1 },
    { id: "b", place: 2 },
  ]);
  const after = view([
    { id: "a", place: 2 },
    { id: "b", place: 1 },
  ]);
  expect(stageCallouts(before, after)).toEqual([
    { id: "lead-race-b-10000", text: "B takes the lead", tone: "lead" },
  ]);
  // The scramble off the grid is not a lead change.
  expect(stageCallouts(before, { ...after, elapsedMs: 1000 })).toEqual([]);
  // Nothing without a previous frame, or across races.
  expect(stageCallouts(undefined, after)).toEqual([]);
  expect(stageCallouts(before, { ...after, raceId: "other" })).toEqual([]);
  const lap2 = view([
    { id: "a", place: 1, lap: 2 },
    { id: "b", place: 2 },
  ]);
  expect(stageCallouts(before, lap2)).toEqual([
    { id: "lap-race-2", text: "Lap 2 of 3", tone: "lap" },
  ]);
  const final = view([
    { id: "a", place: 1, lap: 3 },
    { id: "b", place: 2 },
  ]);
  expect(stageCallouts(lap2, final)).toEqual([
    { id: "final-race", text: "Final lap!", tone: "final" },
  ]);
  // A one-lap race has no lap call-outs.
  expect(stageCallouts({ ...before, laps: 1 }, { ...lap2, laps: 1 })).toEqual([]);
});

it("announces the winner and later finishers in place order", () => {
  const before = view([
    { id: "a", place: 1, lap: 3 },
    { id: "b", place: 2, lap: 3 },
    { id: "c", place: 3, lap: 3 },
  ]);
  const after = view([
    { id: "a", place: 1, lap: 3, status: "FINISHED" },
    { id: "b", place: 2, lap: 3, status: "FINISHED" },
    { id: "c", place: 3, lap: 3 },
  ]);
  expect(stageCallouts(before, after)).toEqual([
    { id: "win-race", text: "A wins!", tone: "win" },
    { id: "finish-race-b", text: "B finishes 2nd", tone: "finish" },
  ]);
  expect(stageCallouts(after, after)).toEqual([]);
});

it("gives this phone its place changes, laps, final lap and finish", () => {
  const start = view([
    { id: "a", place: 1 },
    { id: "b", place: 2 },
  ]);
  expect(
    selfCues(
      start,
      view([
        { id: "a", place: 2 },
        { id: "b", place: 1, lap: 2 },
      ]),
    ),
  ).toEqual([
    { kind: "lap", lap: 2, laps: 3 },
    { kind: "place", place: 1, gained: true },
  ]);
  expect(
    selfCues(
      start,
      view([
        { id: "a", place: 1 },
        { id: "b", place: 2, lap: 3 },
      ]),
    ),
  ).toEqual([{ kind: "final-lap" }]);
  expect(
    selfCues(
      start,
      view([
        { id: "a", place: 2 },
        { id: "b", place: 1, status: "FINISHED" },
      ]),
    ),
  ).toEqual([{ kind: "finish", place: 1 }]);
  // Spectators and the first frame have no cues.
  expect(selfCues(start, { ...start, selfPlayerId: null })).toEqual([]);
  expect(selfCues(undefined, start)).toEqual([]);
});
