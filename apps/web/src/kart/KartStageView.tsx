import { lazy, Suspense, useState } from "react";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { liveKartVfxPreset } from "./live-vfx";
import type { KartRaceView } from "@26/shared";
import { KartMap } from "./KartMap";
import { GraphicsControls } from "./graphics-controls";
import { useKartGraphics } from "./graphics-preferences";
const KartCanvas = lazy(() => import("./KartCanvas"));

export function KartStageView({
  race,
  paused = false,
}: {
  race: KartRaceView;
  paused?: boolean;
}) {
  const [localMap, setLocalMap] = useState<string>();
  const reduced = usePrefersReducedMotion();
  const graphics = useKartGraphics(race.participantCount ?? race.participants.length);
  const mode = race.spectator?.mode ?? "map";
  const selection = `${race.raceId}:${mode}:${race.spectator?.revision ?? 0}`;
  const show3D = mode !== "map" && localMap !== selection;
  return (
    <div className="kart-stage-camera">
      <div className="kart-viewport kart-spectator-viewport">
        <KartMap race={race} />
        {show3D ? (
          <Suspense
            fallback={
              <p className="kart-driver-loading">
                Preparing stage circuit… The full map remains available.
              </p>
            }
          >
            <div className="kart-stage-3d">
              <KartCanvas
                race={race}
                mobile={false}
                spectator
                reducedMotion={Boolean(reduced)}
                paused={paused}
                vfxPreset={liveKartVfxPreset(race.effectsEnabled)}
                followPlayerId={race.spectator?.followPlayerId}
                graphicsTier={graphics.tier}
                onFrameHealth={graphics.onHealth}
              />
            </div>
          </Suspense>
        ) : null}
        <div className="kart-map-summary">
          <strong>{race.participants.length}</strong>
          <span>drivers · one lap</span>
        </div>
      </div>
      {mode !== "map" ? (
        <>
          <p role="status">
            {show3D ? `Stage view: ${mode}` : "Full-field map on this screen"}
            {show3D && race.spectator?.followPlayerId
              ? ` · ${race.participants.find((driver) => driver.playerId === race.spectator!.followPlayerId)?.name ?? "Racer"}`
              : ""}
          </p>
          <button
            type="button"
            className="kart-view-toggle"
            onClick={() => setLocalMap(show3D ? selection : undefined)}
          >
            {show3D ? "Return to full-field map" : "Use host stage view"}
          </button>
          {show3D ? <GraphicsControls {...graphics} /> : null}
        </>
      ) : null}
    </div>
  );
}
