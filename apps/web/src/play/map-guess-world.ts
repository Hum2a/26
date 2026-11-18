import type { geoJSON } from "leaflet";

type World = Parameters<typeof geoJSON>[0];
let world: Promise<World> | undefined;
export function loadWorld() {
  return (world ??= fetch("/assets/maps/world.geojson")
    .then((response) => {
      if (!response.ok) throw new Error("Map unavailable");
      return response.json() as Promise<World>;
    })
    .catch((error: unknown) => {
      world = undefined;
      throw error;
    }));
}
