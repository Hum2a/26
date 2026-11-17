import { useState } from "react";
import {
  createKartRace,
  projectKartRace,
  createDrivingBody,
  kartNeutral,
  type KartFinish,
  type KartRaceView,
  type LobbySnapshot,
} from "@26/shared";
import { GuestKart } from "../kart/GuestKart";
import { Button } from "../ui/primitives";

function sample(run: number): KartRaceView {
  const saved = createKartRace(`rollback-bench-${run}`, [
    { playerId: "stand-in", name: "Stand-in driver" },
  ]);
  const d = saved.drivers[0]!;
  return {
    ...projectKartRace(saved, "stand-in", 0),
    timingMode: "device-v1",
    rollback: {
      revision: 1,
      appliedSequence: -1,
      recovery: 0,
      body: createDrivingBody(d.x, d.z, d.heading),
      lap: { angle: d.angle, distance: d.distance, checkpoint: 0, done: 0, splits: [] },
      input: kartNeutral,
    },
  };
}
const noWire = () => {};
/** Explicit isolated adapter: no socket, receipts, live room or awarded points. */
export function KartRollbackBench() {
  const [race, setRace] = useState(() => sample(0));
  const [paused, setPaused] = useState(false),
    [connected, setConnected] = useState(true);
  const [report, setReport] = useState<KartFinish>();
  const [notice, setNotice] = useState("");
  const change = (kind: "correction" | "old" | "recovery" | "finish") =>
    setRace((previous) => {
      const seed = previous.rollback!;
      if (kind === "old")
        return {
          ...previous,
          rollback: {
            ...seed,
            revision: Math.max(0, seed.revision - 1),
            body: { ...seed.body, x: 100 },
          },
        };
      return {
        ...previous,
        rollback: {
          ...seed,
          revision: seed.revision + 2,
          recovery: seed.recovery + (kind === "recovery" ? 1 : 0),
          body:
            kind === "finish"
              ? { ...createDrivingBody(43, -0.04, Math.PI / 2), vz: 10 }
              : { ...seed.body, x: seed.body.x + 2 },
          lap:
            kind === "finish"
              ? {
                  angle: -0.001,
                  distance: Math.PI * 2 - 0.001,
                  checkpoint: 7,
                  done: 0,
                  splits: [],
                }
              : seed.lap,
        },
      };
    });
  return (
    <section aria-label="Rollback rehearsal" className="admin-kart-pane">
      <h2>Rollback and device timing</h2>
      <p>
        Isolated stand-in driver using the real phone renderer. These labelled sample
        checkpoints simulate network corrections. Nothing is sent or scored. Switch to
        Map view if 3D is unavailable.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => change("correction")}>
          Delayed correction
        </Button>
        <Button variant="secondary" onClick={() => change("old")}>
          Older frame
        </Button>
        <Button variant="secondary" onClick={() => change("recovery")}>
          Recovery checkpoint
        </Button>
        <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume sample" : "Pause sample"}
        </Button>
        <Button variant="secondary" onClick={() => setConnected((value) => !value)}>
          {connected ? "Disconnect sample" : "Reconnect sample"}
        </Button>
        <Button variant="secondary" onClick={() => change("finish")}>
          Finish line sample
        </Button>
        <Button
          variant="secondary"
          disabled={!report}
          onClick={() => {
            if (!report) return;
            setNotice("Finish saved — sample receipt");
            setRace((previous) => ({
              ...previous,
              participants: previous.participants.map((d) => ({
                ...d,
                status: "FINISHED",
                lapTimeMs: report.elapsedMs,
              })),
            }));
          }}
        >
          Accept sample finish
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setRace((previous) =>
              sample(Number(previous.raceId.split("-").at(-1)) + 1),
            );
            setReport(undefined);
            setNotice("");
            setPaused(false);
          }}
        >
          Reset sample
        </Button>
      </div>
      <p role="status">
        {report
          ? `Sample device duration: ${report.elapsedMs} ms; ${notice || "awaiting sample receipt"}`
          : "Drive locally between sample frames."}
      </p>
      <div className="admin-phone-preview">
        <GuestKart
          snapshot={
            {
              phase: "collect",
              paused,
              held: false,
              play: { question: { kind: "kart" }, kart: race },
            } as unknown as LobbySnapshot
          }
          connected={connected}
          onInput={noWire}
          onFinish={setReport}
          finishNotice={notice}
        />
      </div>
    </section>
  );
}
