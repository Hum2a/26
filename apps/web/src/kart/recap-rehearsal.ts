import { createKartRace, reduceKart, kartNeutral, type KartRace } from "@26/shared";
export type KartRecapRehearsal =
  "timeout" | "host-ended" | "finished" | "recovery" | "older";
/** Labelled stand-ins driven through the actual reducer; no live room or fabricated splits. */
export function kartRecapRehearsal(kind: KartRecapRehearsal): KartRace {
  let race = createKartRace(`recap-${kind}`, [
    { playerId: "stand-in-a", name: "Stand-in Amina" },
    ...(kind === "finished"
      ? []
      : [{ playerId: "stand-in-b", name: "Stand-in Bilal" }]),
  ]);
  for (let t = 0; t < 45000 && !race.ended; t += 100) {
    race = reduceKart(race, {
      type: "input",
      playerId: "stand-in-a",
      value: {
        raceId: race.raceId,
        sequence: t + 1,
        ...kartNeutral,
        gas: true,
        steer: 0.2381,
      },
    });
    race = reduceKart(race, { type: "tick", elapsedMs: t + 100 });
    if (kind === "recovery" && t === 3000)
      race = reduceKart(race, { type: "recover", playerId: "stand-in-a" });
    if (kind === "host-ended" && t === 3000) {
      race = reduceKart(race, { type: "end" });
      break;
    }
  }
  if (kind === "older") {
    delete race.recapVersion;
    delete race.endReason;
    for (const driver of race.drivers) delete driver.lap;
  }
  return race;
}
