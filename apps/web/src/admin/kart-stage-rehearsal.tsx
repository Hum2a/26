import { useCallback, useState } from "react";
import { kartSpectatorView, kartStageModeSchema, type KartStageMode } from "@26/shared";
import KartGameWrapper from "../kart/KartGameWrapper";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readKartPreview } from "./sections-api";
import { useSection } from "./use-section";

export function KartStageRehearsal() {
  const read = useCallback(() => readKartPreview("turn"), []);
  const sample = useSection(read);
  const [mode, setMode] = useState<KartStageMode>("map");
  const [revision, setRevision] = useState(0);
  return (
    <section className="admin-kart-pane" aria-label="Stage camera rehearsal">
      <h2>Stage views</h2>
      <p>
        80 labelled stand-ins, using the real stage renderer. No room or guest
        connection. Follow selects the leading active racer; director selection uses
        accepted sample time. Return to the full-field map at any point.
      </p>
      {kartStageModeSchema.options.map((value) => (
        <Button
          key={value}
          variant="secondary"
          aria-pressed={mode === value}
          onClick={() => {
            setMode(value);
            setRevision((current) => current + 1);
          }}
        >
          {value === "map" ? "Rehearse full-field map" : `Rehearse ${value}`}
        </Button>
      ))}
      <Button
        variant="secondary"
        disabled={sample.loading}
        onClick={() => {
          setMode("map");
          setRevision((current) => current + 1);
          void sample.refresh();
        }}
      >
        Reset stage rehearsal
      </Button>
      <EntryNotice message={sample.error} />
      {sample.loading ? (
        <p role="status">Loading stand-in stage poses…</p>
      ) : sample.data ? (
        <>
          <p>{sample.data.label}</p>
          <KartGameWrapper
            race={{
              ...sample.data.stage,
              spectator: {
                ...kartSpectatorView(
                  mode,
                  sample.data.stage.participants,
                  sample.data.stage.elapsedMs,
                ),
                revision,
              },
            }}
          />
        </>
      ) : null}
    </section>
  );
}
