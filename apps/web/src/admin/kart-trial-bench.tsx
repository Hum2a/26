import { useState } from "react";
import { createKartTrial, type KartTrial } from "@26/shared";
import { KartTimeTrial } from "../kart/KartTimeTrial";
import { KartTrialRecords } from "../kart/KartTrialRecords";
import { emptyKartRecords } from "../kart/kart-records";
import { Button } from "../ui/primitives";

const initial = () =>
  createKartTrial({
    version: 1,
    track: "mario-circuit-v1",
    physics: "arcade-v2",
    handling: "slide-v1",
    laps: 3,
    assists: "none",
    items: false,
    course: { boosts: false, ramps: false, hazards: false },
  });
export function KartTrialBench() {
  const [trial, setTrial] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [records, setRecords] = useState(emptyKartRecords);
  const sample = (
    state: "waiting" | "driving" | "assisted" | "invalid" | "finished",
  ) => {
    const base = initial();
    setPaused(false);
    if (state === "waiting") {
      setTrial(base);
      return;
    }
    const live: KartTrial = {
      ...base,
      startedMs: 0,
      lapStartedMs: 0,
      observedMs: 12400,
      elapsedMs: 12400,
      lapElapsedMs: 12400,
      cursor: { angle: 400, distance: 400, checkpoint: 2 },
      sectorsMs: [6000, 6400],
      notice: "Follow all eight sectors",
    };
    setTrial(
      state === "finished"
        ? {
            ...live,
            finished: true,
            cursor: { ...live.cursor, checkpoint: 8 },
            elapsedMs: 72000,
            laps: Array.from({ length: 3 }, () => ({
              timeMs: 24000,
              sectorsMs: Array(8).fill(3000),
              quality: "clean" as const,
            })),
            notice: "Trial complete",
          }
        : {
            ...live,
            quality: state === "driving" ? "clean" : state,
            notice:
              state === "invalid"
                ? "Lap invalid — restart for a clean run"
                : state === "assisted"
                  ? "Recovery used — this lap is assisted"
                  : live.notice,
          },
    );
  };
  return (
    <section className="admin-kart-pane" aria-label="Time trial rehearsal">
      <h2>Time trials</h2>
      <p>
        Labelled stand-in times, using the actual practice HUD and result components. No
        room, scores or saved records are changed. Drive below for an actual timed run.
      </p>
      <div className="flex flex-wrap gap-3">
        {(["waiting", "driving", "assisted", "invalid", "finished"] as const).map(
          (state) => (
            <Button key={state} variant="secondary" onClick={() => sample(state)}>
              Rehearse {state}
            </Button>
          ),
        )}
        <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume trial preview" : "Pause trial preview"}
        </Button>
      </div>
      <KartTimeTrial
        trial={trial}
        paused={paused}
        onRestart={() => {
          setTrial(initial());
          setPaused(true);
        }}
      />
      <KartTrialRecords
        data={records}
        config={trial.config}
        notice="Stand-in storage — this rehearsal never writes browser records"
        onEnabled={(enabled) => setRecords({ ...records, enabled, records: [] })}
        onClear={() => setRecords({ ...records, records: [] })}
      />
      <p>
        In the real practice frame, Course set-up selects free drive or one-/three-lap
        time trials, controls item boxes and clears/forgets this browser’s opt-in
        records. Course and handling changes reset and pause the run. The trial clock
        starts at the coloured timing line, which is separate from the decorative
        chequered grid.
      </p>
      <iframe
        className="admin-kart-drive-frame"
        title="Time trial practice"
        src="/kart-engine/index.html"
        allow="fullscreen"
      />
    </section>
  );
}
