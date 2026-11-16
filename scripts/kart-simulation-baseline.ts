import { performance } from "node:perf_hooks";
import {
  createKartRace,
  reduceKartTimeline,
} from "../packages/shared/src/kart/kart.ts";

// Pure simulation only: no sockets, SQLite, Worker runtime or physical renderer.
for (const size of [50, 80]) {
  for (const inputHz of [0, 10]) {
    let race = createKartRace(
      "simulation-baseline",
      Array.from({ length: size }, (_, i) => ({
        playerId: String(i),
        name: `Racer ${i + 1}`,
      })),
      { trackId: "mario-circuit-v1" },
    );
    const began = performance.now();
    const cpu = process.cpuUsage();
    for (let target = 200; target <= 20_000; target += 200) {
      const events =
        inputHz === 0
          ? []
          : [target - 200, target - 100].flatMap((elapsed) =>
              race.drivers.map((driver, index) => ({
                playerId: driver.playerId,
                elapsed,
                input: {
                  raceId: race.raceId,
                  sequence: elapsed / 100 + 1,
                  steer: index % 3 === 0 ? 0.24 : -0.1,
                  gas: true,
                  brake: false,
                  drift: false,
                },
              })),
            );
      race = reduceKartTimeline(race, events, target);
    }
    if (race.elapsedMs !== 20_000 || race.drivers.length !== size)
      throw new Error("Simulation did not reach the measured target.");
    const used = process.cpuUsage(cpu);
    console.log(
      JSON.stringify({
        environment: "Node pure simulation; not Worker CPU",
        trackId: race.trackId,
        racers: size,
        inputHz,
        simulatedMs: race.elapsedMs,
        wallMs: Math.round(performance.now() - began),
        processCpuMs: Math.round((used.user + used.system) / 1000),
      }),
    );
  }
}
