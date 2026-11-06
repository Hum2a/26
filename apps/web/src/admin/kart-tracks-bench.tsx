import { useCallback, useId, useState } from "react";
import { LinkButton, Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { useSection } from "./use-section";
import { readKartTracks } from "./sections-api";
import { KartMap } from "../kart/KartMap";
import { KartDriverView } from "../kart/KartDriverView";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { AnimatePresence, motion } from "motion/react";
import { kartTrackSelectionSchema, type KartTrackSelection } from "@26/shared";

export function KartTracksBench() {
  const id = useId(),
    reduced = usePrefersReducedMotion();
  const [selection, setSelection] = useState<KartTrackSelection>({
    track: "mario-circuit-v1",
    slot: 1,
    beat: "grid",
  });
  const [threeD, setThreeD] = useState(false);
  const read = useCallback(() => readKartTracks(selection), [selection]);
  const sample = useSection(read);
  const track = sample.data?.catalogue.tracks.find(
    (track) => track.id === sample.data?.selection.track,
  );
  const choose = (patch: Partial<KartTrackSelection>) =>
    setSelection((previous) =>
      kartTrackSelectionSchema.parse({ ...previous, ...patch }),
    );
  return (
    <section className="admin-kart-pane" aria-label="Tracks and modes catalogue">
      <h2>Tracks &amp; modes</h2>
      <p>
        Installed courses and actual shared grid/recovery previews with80 labelled
        stand-ins. Selections here rehearse the course; choose real race settings in
        Live controls. Mode availability below describes what works today.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-track`}>Preview track</label>
        <select
          id={`${id}-track`}
          value={selection.track}
          onChange={(e) =>
            choose({ track: e.target.value as KartTrackSelection["track"] })
          }
        >
          <option value="mario-circuit-v1">Mario circuit</option>
          <option value="party-ring-v1">Party ring</option>
        </select>
        <label htmlFor={`${id}-slot`}>Starting-grid slot</label>
        <select
          id={`${id}-slot`}
          value={selection.slot}
          onChange={(e) => choose({ slot: Number(e.target.value) })}
        >
          {Array.from({ length: 80 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Slot {i + 1}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-beat`}>Preview state</label>
        <select
          id={`${id}-beat`}
          value={selection.beat}
          onChange={(e) =>
            choose({ beat: e.target.value as KartTrackSelection["beat"] })
          }
        >
          <option value="grid">Starting grid</option>
          <option value="recovery">Back to accepted grid pose</option>
        </select>
        <Button
          variant="secondary"
          disabled={sample.loading}
          onClick={() => void sample.refresh()}
        >
          Reload catalogue
        </Button>
      </div>
      <EntryNotice message={sample.error} />
      <AnimatePresence mode="wait" initial={false}>
        {sample.loading ? (
          <motion.p
            key="loading"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            Loading course catalogue…
          </motion.p>
        ) : track && sample.data ? (
          <motion.div
            key={`${sample.data.selection.track}-${sample.data.selection.slot}-${sample.data.selection.beat}`}
            className="admin-kart-pane"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            <h3>
              {track.name} ·{" "}
              {track.origin === "original"
                ? "Original party course"
                : "Imported circuit"}
            </h3>
            <p>
              Catalogue {sample.data.catalogue.version} · {track.id}
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <dt>Route</dt>
              <dd>
                {Math.round(track.route.metres)}m · {track.route.sectors} ordered
                sectors · {track.route.segments} segments
              </dd>
              <dt>Collision</dt>
              <dd>
                {track.collision.segments} wall segments · {track.collision.bodyRadius}m
                kart radius
              </dd>
              <dt>Surface</dt>
              <dd>
                {track.surface === "baked-road-dirt"
                  ? "Verified road and dirt triangles"
                  : "Original annular road"}
              </dd>
              <dt>Grid</dt>
              <dd>
                {track.grid.slots} slots · {track.grid.columns} columns ·{" "}
                {track.grid.rowSpacingMetres}m row spacing
              </dd>
              <dt>Recovery</dt>
              <dd>Last accepted safe pose; accepted progress rolls back with it</dd>
              <dt>Item boxes</dt>
              <dd>{track.itemBoxes}</dd>
              <dt>Course features</dt>
              <dd>
                {track.features.boosts} boost · {track.features.ramps} ramp ·{" "}
                {track.features.sweepers} sweeper
              </dd>
              <dt>Current race limit</dt>
              <dd>{track.raceLimitMs / 1000} seconds</dd>
            </dl>
            <ul aria-label="Course mode availability">
              {track.modes.map((mode) => (
                <li key={mode.id}>
                  <strong>
                    {mode.label} · {mode.available ? "Available" : "Pending"}
                  </strong>
                  <p>{mode.detail}</p>
                </li>
              ))}
            </ul>
            {track.id === "mario-circuit-v1" && (
              <LinkButton to="/kart" target="_blank" rel="noreferrer">
                Open existing solo practice
              </LinkButton>
            )}
            <p>{sample.data.label}</p>
            <div style={{ maxWidth: "42rem" }}>
              <KartMap race={sample.data.stage} />
            </div>
            <Button
              variant="secondary"
              aria-pressed={threeD}
              onClick={() => setThreeD((value) => !value)}
            >
              {threeD ? "Close 3D grid preview" : "Open 3D grid preview"}
            </Button>
            <AnimatePresence>
              {threeD && (
                <motion.div
                  key="three-d-preview"
                  className="admin-kart-vehicle-phone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0.1 : 0.15, ease: "easeOut" }}
                >
                  <KartDriverView
                    key={selection.track}
                    race={sample.data.phone}
                    reducedMotion={reduced}
                    paused
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
