import {
  createKartRace,
  projectKartRace,
  kartRehearsalBeatSchema,
  kartRehearsalSchema,
} from "@26/shared";
import { phoneRaceView } from "../../questions/kart/kart.ts";

/** Explicit public sample poses, not a room, result or guest-action adapter. */
export function kartPreview(value: unknown) {
  const beat = kartRehearsalBeatSchema.parse(value);
  const race = createKartRace(
    "admin-render-preview",
    Array.from({ length: 80 }, (_, i) => ({
      playerId: `stand-in-${i + 1}`,
      name: `Stand-in ${i + 1}`,
    })),
    { trackId: "mario-circuit-v1", seedGrid: true },
  );
  race.opponentsEnabled = true;
  race.elapsedMs = beat === "grid" ? 0 : beat === "finish" ? 30_000 : 4000;
  for (const driver of race.drivers) {
    if (beat === "turn") {
      driver.turn = 0.5;
      driver.speed = 15;
      driver.driftMs = 1200;
      driver.wasDrifting = true;
      driver.heading += 0.1;
    }
    if (beat === "boost") {
      driver.speed = 25;
      driver.boostMs = 900;
    }
    if (beat === "finish") {
      driver.status = "FINISHED";
      driver.lapTimeMs = 25_000 + driver.number * 20;
    }
  }
  race.ended = beat === "finish";
  const stage = projectKartRace(race, null, 100);
  return kartRehearsalSchema.parse({
    label: "Stand-in drivers — isolated rendering rehearsal",
    phone: phoneRaceView(race, stage, "stand-in-41", 0),
    stage,
  });
}
