import type { LobbySnapshot } from "@26/shared";
import { expect, it } from "vitest";
import { kartRaceScene } from "./race-scene";

function snapshot(phase: string, kind = "kart", raceId: string | null = "race-1") {
  return {
    phase,
    play: {
      question: { kind },
      kart: raceId ? { raceId } : undefined,
    },
  } as unknown as LobbySnapshot;
}

it("keeps one scene from the grid to the race and ends it at the reveal", () => {
  const scenes = ["intro", "prompt", "collect"].map((phase) =>
    kartRaceScene(snapshot(phase)),
  );
  expect(new Set(scenes)).toEqual(new Set(["kart:race-1"]));
  expect(kartRaceScene(snapshot("reveal"))).toBeUndefined();
  expect(kartRaceScene(snapshot("scores"))).toBeUndefined();
});

it("gives a new race its own scene", () => {
  expect(kartRaceScene(snapshot("collect", "kart", "race-2"))).toBe("kart:race-2");
});

it("leaves other questions and a missing race on ordinary phase transitions", () => {
  expect(kartRaceScene(undefined)).toBeUndefined();
  expect(kartRaceScene(snapshot("collect", "choice"))).toBeUndefined();
  expect(kartRaceScene(snapshot("intro", "kart", null))).toBeUndefined();
});
