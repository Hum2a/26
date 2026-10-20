import { expect, it } from "vitest";
import { createKartRace, projectKartRace, type LobbySnapshot } from "@26/shared";
import { guestRoundCopy } from "./copy";

it("describes server-accepted race results without claiming a missing quiz answer", () => {
  const race = createKartRace("copy-fixture", [{ playerId: "a", name: "Amina" }]);
  race.ended = true;
  race.drivers[0]!.status = "FINISHED";
  race.drivers[0]!.lapTimeMs = 27_050;
  const snapshot = {
    phase: "reveal",
    paused: false,
    held: false,
    play: {
      question: { kind: "kart" },
      kart: projectKartRace(race, "a", 100),
      selfAnswer: null,
      reveal: null,
      selfAward: 100,
      selfStanding: null,
    },
  } as unknown as LobbySnapshot;
  expect(guestRoundCopy(snapshot)).toBe(
    "Lap finished in 27.05 seconds. You scored 100.",
  );
  race.drivers[0]!.status = "DNF";
  race.drivers[0]!.lapTimeMs = null;
  snapshot.play!.kart = projectKartRace(race, "a", 100);
  expect(guestRoundCopy(snapshot)).toContain("DNF — 0 points");
  expect(guestRoundCopy({ ...snapshot, paused: true })).toBe("The game is paused.");
});

it("directs drivers to their own screen rather than finding a kart on the TV", () => {
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: {
      question: { kind: "kart" },
      kart: projectKartRace(
        createKartRace("copy", [{ playerId: "me", name: "Driver" }]),
        "me",
        100,
      ),
    },
  } as unknown as LobbySnapshot;
  expect(guestRoundCopy(snapshot)).toContain("Race on your phone");
  expect(guestRoundCopy({ ...snapshot, phase: "prompt" })).toContain(
    "driving view opens on this phone",
  );
});
