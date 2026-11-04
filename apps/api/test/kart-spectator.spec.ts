import { expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  kartRaceSchema,
  kartSpectatorView,
} from "@26/shared";
import { changeKartStage } from "../src/questions/kart";

it("selects from accepted race time, stable roster order and active progress without changing race results", () => {
  const race = createKartRace(
    "stage",
    Array.from({ length: 80 }, (_, i) => ({ playerId: "p" + i, name: "Racer" + i })),
  );
  race.drivers[4]!.progress = 0.8;
  race.drivers[5]!.progress = 0.7;
  expect(kartSpectatorView("follow", race.drivers, 0).followPlayerId).toBe("p4");
  expect(kartSpectatorView("director", race.drivers, 7999).followPlayerId).toBe("p4");
  expect(kartSpectatorView("director", race.drivers, 8000).followPlayerId).toBe("p5");
  expect(kartSpectatorView("director", race.drivers, 8000)).toEqual(
    kartSpectatorView("director", JSON.parse(JSON.stringify(race.drivers)), 8000),
  );
  race.drivers[4]!.status = "DNF";
  expect(kartSpectatorView("follow", race.drivers, 9000).followPlayerId).toBe("p5");
  const before = JSON.stringify(race);
  const old = projectKartRace(race, null, 100);
  expect(old.spectator).toBeUndefined();
  expect(kartRaceSchema.parse(old).participants).toHaveLength(80);
  race.stageMode = "overview";
  expect(projectKartRace(race, null, 100).leaderboard).toEqual(old.leaderboard);
  expect(JSON.stringify({ ...race, stageMode: undefined })).toBe(before);
  expect(
    kartRaceSchema.parse({ ...old, spectator: { mode: "future" } }).spectator,
  ).toBeUndefined();
  expect(kartSpectatorView("follow", [], 0)).toEqual({ mode: "overview" });
});
it("validates stage commands again before touching storage", () => {
  const sql = {} as SqlStorage;
  expect(() => changeKartStage(sql, "unknown", 1)).toThrow("valid stage view");
  expect(() => changeKartStage(sql, "map", NaN)).toThrow("valid stage view");
});
