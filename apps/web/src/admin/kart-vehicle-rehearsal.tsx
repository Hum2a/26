import { useCallback, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { driverStyles, type DriverStyle, kartRehearsalBeatSchema } from "@26/shared";
import { KartDriverView } from "../kart/KartDriverView";
import { KartDriversContext } from "../kart/drivers-context";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readKartPreview } from "./sections-api";
import { useSection } from "./use-section";
import { SoloPracticeFrame } from "../kart/SoloPracticeFrame";
import {
  readPracticePresentation,
  practicePresentationKind,
} from "../kart/practice-presentation";

export function KartVehicleRehearsal() {
  const [beat, setBeat] = useState<"grid" | "turn" | "boost" | "finish">("grid");
  const [style, setStyle] = useState<DriverStyle>("racer");
  const [practice, setPractice] = useState(false);
  const [face, setFace] = useState<Blob | null>(null);
  const [faceError, setFaceError] = useState("");
  const read = useCallback(() => readKartPreview(beat), [beat]);
  const sample = useSection(read);
  const reduced = useReducedMotion();
  const drivers = useMemo(
    () => ({
      gameId: "",
      byPlayer: new Map(
        (sample.data?.stage.participants ?? []).map((driver) => [
          driver.playerId,
          {
            style:
              driver.playerId === "stand-in-41"
                ? style
                : driverStyles[(driver.number - 1) % driverStyles.length]!.id,
          },
        ]),
      ),
    }),
    [sample.data, style],
  );
  return (
    <section className="admin-kart-pane" aria-label="Vehicle rehearsal">
      <h2>Vehicles and nearby racers</h2>
      <p>
        Public sample poses for 80 stand-in drivers. No room, socket, controls, party
        score or guest photo is used. Choose High in the real phone viewport to inspect
        the detailed kart; Low retains simple vehicles.
      </p>
      <label>
        Sample pose{" "}
        <select
          aria-label="Sample kart pose"
          value={beat}
          onChange={(event) => {
            const next = kartRehearsalBeatSchema.safeParse(event.target.value);
            if (next.success) setBeat(next.data);
          }}
        >
          {kartRehearsalBeatSchema.options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Driver{" "}
        <select
          aria-label="Rehearsal driver"
          value={style}
          onChange={(event) => {
            const chosen = driverStyles.find(
              (driver) => driver.id === event.target.value,
            );
            if (chosen) setStyle(chosen.id);
          }}
        >
          {driverStyles.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        disabled={sample.loading}
        onClick={() => void sample.refresh()}
      >
        Reset vehicle preview
      </Button>
      <EntryNotice message={sample.error} />
      <p role="status">
        {sample.loading
          ? "Loading sample poses…"
          : (sample.data?.label ?? "Preview unavailable")}
      </p>
      {sample.data && !sample.loading ? (
        <KartDriversContext value={drivers}>
          <div className="admin-kart-vehicle-phone">
            <KartDriverView race={sample.data.phone} reducedMotion={Boolean(reduced)} />
          </div>
        </KartDriversContext>
      ) : null}
      <h3>Solo driver rehearsal</h3>
      <p>
        Use the selected driver in real solo practice. A local sample photo stays in
        this page and the practice frame; it is never uploaded or saved.
      </p>
      <label>
        Local sample face{" "}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            const chosen = readPracticePresentation({
              kind: practicePresentationKind,
              style,
              face: file,
            });
            setFace(chosen?.face ?? null);
            setFaceError(chosen ? "" : "Choose a PNG, JPEG or WebP up to 2 MB.");
          }}
        />
      </label>
      <Button variant="secondary" onClick={() => setFace(null)} disabled={!face}>
        Clear sample face
      </Button>
      <EntryNotice message={faceError} />
      <Button
        variant="secondary"
        aria-expanded={practice}
        onClick={() => setPractice((value) => !value)}
      >
        {practice ? "Close solo driver rehearsal" : "Open solo driver rehearsal"}
      </Button>
      {practice ? <SoloPracticeFrame driver={{ style }} sampleFace={face} /> : null}
    </section>
  );
}
