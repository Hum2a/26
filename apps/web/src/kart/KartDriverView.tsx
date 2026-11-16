import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KartRenderState } from "./view-readiness";
import type { KartRaceView } from "@26/shared";
import { KartMap } from "./KartMap";
import { GraphicsControls } from "./graphics-controls";
import { useKartGraphics } from "./graphics-preferences";
import { liveKartVfxPreset } from "./live-vfx";
import { liveKartLookPreset } from "./live-look";
import type { SelfPrediction } from "./self-prediction";
import "./kart.css";
const KartCanvas = lazy(() => import("./KartCanvas"));

export function KartDriverView({
  race,
  reducedMotion,
  paused = false,
  prediction,
  onReadiness,
}: {
  race: KartRaceView;
  reducedMotion: boolean;
  paused?: boolean;
  prediction?: SelfPrediction;
  onReadiness?: (raceId: string, usable: boolean) => void;
}) {
  const [map, setMap] = useState(false);
  const [inset, setInset] = useState(false);
  const [renderState, setRenderState] = useState<KartRenderState>("loading");
  const [attempt, setAttempt] = useState(0);
  const report = useCallback((state: KartRenderState) => setRenderState(state), []);
  useEffect(() => {
    onReadiness?.(race.raceId, map || renderState === "usable");
  }, [onReadiness, race.raceId, map, renderState]);
  const graphics = useKartGraphics(race.participantCount ?? race.participants.length);
  return (
    <div className="kart-driver-view" data-readiness={map ? "map" : renderState}>
      <div
        className="kart-driver-viewport"
        data-view={map ? "map" : "chase"}
        data-inset={inset}
      >
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
              key={`${race.raceId}-${attempt}`}
              race={race}
              mobile
              reducedMotion={
                reducedMotion || (paused && race.effectsEnabled === undefined)
              }
              paused={paused}
              vfxPreset={liveKartVfxPreset(race.effectsEnabled)}
              lookPreset={liveKartLookPreset(race.look)}
              followPlayerId={race.selfPlayerId}
              graphicsTier={graphics.tier}
              onFrameHealth={graphics.onHealth}
              prediction={prediction}
              onRenderState={report}
            />
          </Suspense>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {!map && renderState !== "usable" ? (
          <motion.p
            className="kart-driver-loading"
            key={renderState}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {renderState === "failed"
              ? "3D view unavailable — switch to the map to drive, or retry the circuit."
              : "Preparing 3D — controls released. Switch to the map to drive now."}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        className="kart-view-toggle"
        aria-pressed={map}
        aria-label={map ? "Use 3D driving view" : "Use lightweight map"}
        onClick={(event) => {
          if (map) {
            setRenderState("loading");
            setAttempt((value) => value + 1);
          }
          setMap(!map);
          event.currentTarget.blur();
        }}
      >
        {map ? "3D view" : "Map view"}
      </button>
      <div className="kart-view-preferences">
        {!map ? (
          <button
            type="button"
            className="kart-inset-toggle"
            aria-pressed={inset}
            aria-label={inset ? "Hide small map" : "Show small map"}
            onClick={(event) => {
              setInset((value) => !value);
              event.currentTarget.blur();
            }}
          >
            Small map
          </button>
        ) : null}
        <GraphicsControls {...graphics} compact />
      </div>
    </div>
  );
}
