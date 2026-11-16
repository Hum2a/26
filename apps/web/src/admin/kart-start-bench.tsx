import { useId, useState } from "react";
import {
  createKartRace,
  projectKartRace,
  kartNeutral,
  type LobbySnapshot,
  type KartControls,
} from "@26/shared";
import { KartDriverView } from "../kart/KartDriverView";
import { KartCountdown } from "../kart/KartCountdown";
import { TouchController } from "../kart/TouchController";
import { Button } from "../ui/primitives";
import { mapSectorPoint } from "../kart/navigation";

export function KartStartBench() {
  const navigationId = useId();
  const [run, setRun] = useState(0);
  const [usable, setUsable] = useState(false);
  const [connected, setConnected] = useState(true),
    [paused, setPaused] = useState(false);
  const [beat, setBeat] = useState(() => ({ phase: "prompt", at: Date.now() }));
  const [input, setInput] = useState<KartControls>({ ...kartNeutral });
  const [track, setTrack] = useState<"mario-circuit-v1" | "party-ring-v1">(
    "mario-circuit-v1",
  );
  const [checkpoint, setCheckpoint] = useState(0);
  const [reverse, setReverse] = useState(false);
  const race = projectKartRace(
    createKartRace(
      `start-bench-${track}-${run}`,
      [{ playerId: "stand-in", name: "Stand-in driver" }],
      { trackId: track },
    ),
    "stand-in",
    0,
  );
  const sample = mapSectorPoint(race.trackId, checkpoint || 8);
  Object.assign(race.participants[0]!, {
    checkpoint,
    x: sample.x + Math.cos(sample.heading) * 4,
    z: sample.z + Math.sin(sample.heading) * 4,
    heading: sample.heading + (reverse ? Math.PI : 0),
  });
  const snapshot = {
    phase: beat.phase,
    paused,
    held: false,
    serverNow: beat.at,
    deadlineAt: beat.at + (beat.phase === "prompt" ? 3000 : 180000),
    play: { question: { kind: "kart" }, kart: race },
  } as unknown as LobbySnapshot;
  const open = usable && connected && !paused && beat.phase === "collect";
  return (
    <section className="admin-kart-pane" aria-label="Race start rehearsal">
      <h2>Race start and recovery</h2>
      <p>
        Isolated stand-in driver. The real renderer, map, input controls and
        server-clock display are used here. No room is connected, nothing scores and no
        haptics play. The rehearsal clock below is labelled sample data.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setBeat({ phase: "prompt", at: Date.now() });
            setPaused(false);
          }}
        >
          Rehearse countdown
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setBeat({ phase: "collect", at: Date.now() });
            setPaused(false);
          }}
        >
          Rehearse GO
        </Button>
        <Button variant="secondary" onClick={() => setConnected((value) => !value)}>
          {connected ? "Disconnect rehearsal" : "Reconnect rehearsal"}
        </Button>
        <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume rehearsal" : "Pause rehearsal"}
        </Button>
        <Button
          variant="secondary"
          onClick={(event) => {
            event.currentTarget
              .closest("section")
              ?.querySelector("canvas")
              ?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
          }}
        >
          Rehearse 3D interruption event
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setUsable(false);
            setRun((value) => value + 1);
          }}
        >
          Rebuild driving view
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor={`${navigationId}-track`}>Sample navigation track</label>{" "}
          <select
            id={`${navigationId}-track`}
            value={track}
            onChange={(event) => setTrack(event.target.value as typeof track)}
          >
            <option value="mario-circuit-v1">Imported circuit</option>
            <option value="party-ring-v1">Legacy ring</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${navigationId}-sector`}>Sample accepted sector</label>{" "}
          <select
            id={`${navigationId}-sector`}
            value={checkpoint}
            onChange={(event) => setCheckpoint(Number(event.target.value))}
          >
            {Array.from({ length: 8 }, (_, value) => (
              <option key={value} value={value}>
                Next {value === 7 ? "finish line" : `sector ${value + 1}`}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          aria-pressed={reverse}
          onClick={() => setReverse((value) => !value)}
        >
          Turn sample kart around
        </Button>
      </div>
      <p>
        Navigation uses labelled stand-in poses and accepted-sector samples, not a
        simulated lap. The numbered marker is the next sector; F is the finish. The
        arrow shows the kart heading, not a shortcut. Switch between the real full map
        and optional small chase map below.
      </p>
      <p role="status">
        Local view {usable ? "usable" : "loading or unavailable"} ·{" "}
        {connected ? "connected stand-in" : "disconnected stand-in"} ·{" "}
        {open ? "controls ready" : "controls released"}
      </p>
      <div className="kart-start-preview">
        <KartCountdown
          snapshot={snapshot}
          observedAt={beat.at}
          enabled={connected && usable}
        />
        <KartDriverView
          key={race.raceId}
          race={race}
          reducedMotion={false}
          paused={!open}
          onReadiness={(_id, ready) => setUsable(ready)}
        />
        <TouchController disabled={!open} onChange={setInput} />
      </div>
      <output aria-label="Start rehearsal input">
        Accelerate {input.gas ? "on" : "off"} · steering {input.steer.toFixed(2)}
      </output>
      <p>
        Try the interruption event, then the actual Map view and Retry circuit controls.
        Map mode is usable immediately. Rebuilding or retrying3D releases controls until
        the circuit is ready; simple kart fallback remains usable. No guest-ready packet
        can start or stop a room.
      </p>
    </section>
  );
}
