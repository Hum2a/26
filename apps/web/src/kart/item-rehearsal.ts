import {
  createKartRace,
  createDrivingBody,
  createKartPowers,
  kartNeutral,
  reduceKart,
  reduceKartTimeline,
  type KartProjectileKind,
} from "@26/shared";

/** Finite local script through the actual room reducer; no room, socket or scores. */
export function noTargetHomingRehearsal() {
  const race = createKartRace(
    "no-target-sample",
    [
      { playerId: "a", name: "Stand-in Amina" },
      { playerId: "b", name: "Stand-in Bilal" },
    ],
    { itemRules: { version: 2, allowed: ["homing"] } },
  );
  race.drivers[1]!.status = "FINISHED";
  race.drivers[0]!.power!.item = "homing";
  const next = reduceKart(race, { type: "use-power", playerId: "a" });
  return {
    world: next.itemsWorld!,
    actors: next.drivers.map((driver) => ({
      playerId: driver.playerId,
      number: driver.number,
      status: driver.status,
      progress: driver.progress,
      x: driver.x,
      z: driver.z,
      heading: driver.heading,
      height: driver.physics?.height ?? 0,
      power: driver.power!,
    })),
  };
}
export function movingItemRehearsal(kind: KartProjectileKind) {
  let race = createKartRace(
    "moving-item-sample",
    [
      { playerId: "a", name: "Stand-in Amina" },
      { playerId: "b", name: "Stand-in Bilal" },
    ],
    { itemRules: { version: 2, allowed: [kind] } },
  );
  race.courseEnabled = false;
  for (const [index, driver] of race.drivers.entries()) {
    const z = index ? 8 : -8;
    Object.assign(driver, {
      x: 42,
      z,
      heading: Math.PI / 2,
      progress: index ? 0.2 : 0.1,
      distance: index ? 0.2 : 0.1,
      angle: Math.atan2(z, 42),
      power: createKartPowers(),
    });
    driver.physics = createDrivingBody(42, z, Math.PI / 2);
  }
  for (let elapsed = 0; elapsed < 3000; elapsed += 20) {
    if (elapsed === 500) {
      race.drivers[0]!.power!.item = kind;
      race = reduceKart(race, { type: "use-power", playerId: "a" });
      race = reduceKart(race, { type: "items-spawning", enabled: false });
    }
    race = reduceKartTimeline(
      race,
      race.drivers.map((driver) => ({
        playerId: driver.playerId,
        elapsed,
        input: {
          ...kartNeutral,
          raceId: race.raceId,
          sequence: elapsed + 1,
          gas: true,
          steer: 0.2381,
        },
      })),
      elapsed + 20,
    );
  }
  return {
    world: race.itemsWorld!,
    actors: race.drivers.map((driver) => ({
      playerId: driver.playerId,
      number: driver.number,
      status: driver.status,
      progress: driver.progress,
      x: driver.x,
      z: driver.z,
      heading: driver.heading,
      height: driver.physics?.height ?? 0,
      power: driver.power!,
    })),
  };
}
