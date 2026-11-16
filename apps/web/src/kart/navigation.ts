import { parkTrackId, parkRoute, type KartRaceView } from "@26/shared";
export const mapX = (trackId: KartRaceView["trackId"], x: number) =>
  trackId === parkTrackId
    ? (x - 80) * 0.52
    : trackId === "mario-circuit-v1"
      ? (x - 150) * 0.34
      : x;
export const mapZ = (trackId: KartRaceView["trackId"], z: number) =>
  trackId === parkTrackId ? z * 0.52 : trackId === "mario-circuit-v1" ? z * 0.34 : z;
import {
  importedLapLength,
  importedTrackPoint,
} from "../../../../packages/shared/src/kart/kart-route";

export function mapHeadingPath(heading: number) {
  const x = Math.cos(heading),
    z = Math.sin(heading);
  return `M${8 * x} ${8 * z}L${4 * x + 2.5 * z} ${4 * z - 2.5 * x}L${4 * x - 2.5 * z} ${4 * z + 2.5 * x}Z`;
}

/** A public map marker, never a local lap counter or a driving target. */
export function mapSectorPoint(trackId: KartRaceView["trackId"], sector: number) {
  if (!Number.isInteger(sector) || sector < 1 || sector > 8)
    throw new RangeError("Sector must be between one and eight");
  if (trackId === "mario-circuit-v1")
    return importedTrackPoint((sector * importedLapLength) / 8);
  if (trackId === parkTrackId)
    return parkRoute.point((sector * parkRoute.lapLength) / 8);
  const angle = ((sector % 8) * Math.PI) / 4;
  return {
    x: Math.cos(angle) * 42,
    z: Math.sin(angle) * 42,
    heading: angle + Math.PI / 2,
  };
}

export function nextMapSector(race: KartRaceView) {
  const self = race.participants.find(
    (driver) => driver.playerId === race.selfPlayerId,
  );
  if (race.ended || !self || self.status !== "RACING" || self.checkpoint >= 8)
    return undefined;
  const sector = self.checkpoint + 1;
  return { sector, ...mapSectorPoint(race.trackId, sector) };
}
