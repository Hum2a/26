import { z } from "zod";

export const mapPinSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();
export type MapPin = z.infer<typeof mapPinSchema>;

export function pinDistanceKm(a: MapPin, b: MapPin): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Full points at the spot, half at about 693 km, rounded to whole points. */
export function mapGuessPoints(distanceKm: number, maximum: number): number {
  return Math.round(maximum * Math.exp(-distanceKm / 1000));
}
