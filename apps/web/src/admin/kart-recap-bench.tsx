import { useState } from "react";
import { kartRaceRecap, projectKartRace, type LobbySnapshot } from "@26/shared";
import { KartRecapPanel } from "../kart/KartRecapPanel";
import KartGameWrapper from "../kart/KartGameWrapper";
import { GuestKart } from "../kart/GuestKart";
import { kartRecapRehearsal, type KartRecapRehearsal } from "../kart/recap-rehearsal";
import { Button } from "../ui/primitives";

export function KartRecapBench() {
  const [race, setRace] = useState(() => kartRecapRehearsal("timeout"));
  const [self, setSelf] = useState("stand-in-a");
  const view = projectKartRace(race, null, 100);
  const snapshot = {
    phase: "reveal",
    paused: false,
    held: false,
    serverNow: 1000,
    play: { question: { kind: "kart" }, kart: projectKartRace(race, self, 100) },
  } as unknown as LobbySnapshot;
  return (
    <section className="admin-kart-pane" aria-label="Race recap rehearsal">
      <h2>Race results</h2>
      <p>
        Stand-in drivers, using accepted results from the actual reducer. No room,
        ledger or local record is changed. The real phone, stage and host recap
        components appear below.
      </p>
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["timeout", "time limit"],
            ["host-ended", "host early end"],
            ["finished", "all finished"],
            ["recovery", "recovery"],
            ["older", "older race"],
          ] as const
        ).map(([kind, label]) => (
          <Button
            key={kind}
            variant="secondary"
            onClick={() => {
              setRace(kartRecapRehearsal(kind as KartRecapRehearsal));
              setSelf("stand-in-a");
            }}
          >
            Rehearse {label}
          </Button>
        ))}
      </div>
      <label>
        Phone driver{" "}
        <select value={self} onChange={(event) => setSelf(event.target.value)}>
          {race.drivers.map((driver) => (
            <option key={driver.playerId} value={driver.playerId}>
              {driver.name}
            </option>
          ))}
        </select>
      </label>
      <h3>Host history</h3>
      <KartRecapPanel
        recap={kartRaceRecap(race)}
        names={Object.fromEntries(
          race.drivers.map((driver) => [driver.playerId, driver.name]),
        )}
      />
      <h3>Phone results</h3>
      <div className="kart-recap-phone-preview">
        <GuestKart key={`${race.raceId}-${self}`} snapshot={snapshot} />
      </div>
      <h3>Stage results</h3>
      <KartGameWrapper race={view} />
    </section>
  );
}
