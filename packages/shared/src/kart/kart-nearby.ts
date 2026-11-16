/** Cosmetic visibility only; inputs, contacts, checkpoints and scores never use it. */
export const kartNearbyLimit = 8;
type NearbyPose = {
  playerId: string;
  number: number;
  x: number;
  z: number;
  progress: number;
  status: "RACING" | "FINISHED" | "DNF";
};

export function selectNearbyNumbers(
  drivers: readonly NearbyPose[],
  selfPlayerId: string,
  previous: readonly number[] = [],
): number[] {
  const self = drivers.find((driver) => driver.playerId === selfPlayerId);
  if (!self || self.status !== "RACING") return [];
  const retained = new Set(previous.slice(0, kartNearbyLimit));
  return drivers
    .flatMap((driver) => {
      if (driver.playerId === selfPlayerId || driver.status !== "RACING") return [];
      const distance = Math.hypot(driver.x - self.x, driver.z - self.z);
      const progress = Math.abs(driver.progress - self.progress);
      const routeGap = Math.min(progress, 1 - progress);
      const keep = retained.has(driver.number);
      // Entry/exit radii and a small retention advantage prevent boundary flicker.
      if (
        !Number.isFinite(distance) ||
        !Number.isFinite(routeGap) ||
        distance > (keep ? 44 : 36) ||
        routeGap > 0.2
      )
        return [];
      return [
        { number: driver.number, score: distance + routeGap * 40 - (keep ? 4 : 0) },
      ];
    })
    .sort((a, b) => a.score - b.score || a.number - b.number)
    .slice(0, kartNearbyLimit)
    .map((driver) => driver.number);
}
