import { lazy, Suspense, useState } from "react";
import type { KartRaceView } from "@26/shared";
import { KartMap } from "./KartMap";
const KartCanvas = lazy(() => import("./KartCanvas"));

export function KartDriverView({
  race,
  reducedMotion,
}: {
  race: KartRaceView;
  reducedMotion: boolean;
}) {
  const [map, setMap] = useState(false);
  return (
    <div className="kart-driver-view">
      <div className="kart-driver-viewport" data-view={map ? "map" : "chase"}>
        <div className="kart-driver-map">
          <KartMap race={race} personal />
        </div>
        {!map && race.selfPlayerId ? (
          <Suspense
            fallback={
              <p className="kart-driver-loading">Preparing your driving view…</p>
            }
          >
            <KartCanvas
              race={race}
              mobile
              reducedMotion={reducedMotion}
              followPlayerId={race.selfPlayerId}
            />
          </Suspense>
        ) : null}
      </div>
      <button
        type="button"
        className="kart-view-toggle"
        aria-pressed={map}
        aria-label={map ? "Use 3D driving view" : "Use lightweight map"}
        onClick={() => setMap(!map)}
      >
        {map ? "3D view" : "Map view"}
      </button>
    </div>
  );
}
