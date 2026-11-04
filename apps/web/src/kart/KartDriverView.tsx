import { lazy, Suspense, useState } from "react";
import type { KartRaceView } from "@26/shared";
import { KartMap } from "./KartMap";
import { GraphicsControls } from "./graphics-controls";
import { useKartGraphics } from "./graphics-preferences";
import { liveKartVfxPreset } from "./live-vfx";
import "./kart.css";
const KartCanvas = lazy(() => import("./KartCanvas"));

export function KartDriverView({
  race,
  reducedMotion,
  paused = false,
}: {
  race: KartRaceView;
  reducedMotion: boolean;
  paused?: boolean;
}) {
  const [map, setMap] = useState(false);
  const graphics = useKartGraphics(race.participantCount ?? race.participants.length);
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
              reducedMotion={
                reducedMotion || (paused && race.effectsEnabled === undefined)
              }
              paused={paused}
              vfxPreset={liveKartVfxPreset(race.effectsEnabled)}
              followPlayerId={race.selfPlayerId}
              graphicsTier={graphics.tier}
              onFrameHealth={graphics.onHealth}
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
      <GraphicsControls {...graphics} compact />
    </div>
  );
}
