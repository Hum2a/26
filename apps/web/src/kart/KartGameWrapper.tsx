import { useEffect, useRef } from "react";
import type { KartCompletion, KartRaceView } from "@26/shared";
import { KartStageView } from "./KartStageView";
import { KartLeaderboard } from "./KartLeaderboard";
import { KartRecapPanel } from "./KartRecapPanel";
import "./kart.css";

/** Only public, authenticated room snapshots enter the renderer. There is no upstream menu or external service. */
export default function KartGameWrapper({
  race,
  paused = false,
  onRaceComplete,
}: {
  race: KartRaceView | undefined;
  paused?: boolean;
  onRaceComplete?: (result: KartCompletion) => void;
}) {
  const delivered = useRef(new Set<string>());
  useEffect(() => {
    for (const d of race?.participants ?? [])
      if (d.status !== "RACING") {
        const key = `${race!.raceId}:${d.playerId}`;
        if (!delivered.current.has(key)) {
          delivered.current.add(key);
          onRaceComplete?.({
            playerId: d.playerId,
            lapTimeMs: d.lapTimeMs,
            status: d.status,
          });
        }
      }
  }, [race, onRaceComplete]);
  if (!race)
    return (
      <p>
        Get ready. Race on your phone; the live map and scoreboard appear here when the
        host starts the round.
      </p>
    );
  return (
    <section className="kart-stage" aria-label="One-lap kart sprint">
      <div className="kart-race-heading">
        <div>
          <p className="kart-eyebrow">THE 26 GRAND PRIX</p>
          <h2>
            {race.ended
              ? "Chequered flag"
              : paused
                ? "Race paused"
                : "One lap. No excuses."}
          </h2>
        </div>
        {!race.ended ? (
          <p className="kart-time" aria-label="Race time remaining">
            {Math.max(0, (race.timeLimitMs - race.elapsedMs) / 1000).toFixed(1)}
            <small>SECONDS LEFT</small>
          </p>
        ) : null}
      </div>
      <div className="kart-stage-layout">
        <div className="kart-stage-view">
          {race.ended ? (
            <KartRecapPanel
              recap={
                race.presentation && race.presentation.version !== 2
                  ? race.presentation.recap
                  : undefined
              }
              stage
              names={Object.fromEntries(
                race.leaderboard.map((row) => [row.playerId, row.name]),
              )}
            />
          ) : (
            <KartStageView race={race} paused={paused} />
          )}
          {paused ? <p className="kart-paused">PAUSED</p> : null}
        </div>
        <KartLeaderboard key={race.raceId} race={race} paused={paused} />
      </div>
    </section>
  );
}
