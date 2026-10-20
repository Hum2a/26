import { lazy, Suspense, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { KartCompletion, KartRaceView } from "@26/shared";
import "./kart.css";

const KartCanvas = lazy(() => import("./KartCanvas"));

/** Only public, authenticated room snapshots enter the renderer. There is no upstream menu or external service. */
export default function KartGameWrapper({
  race,
  paused = false,
  mobile = false,
  onRaceComplete,
}: {
  race: KartRaceView | undefined;
  paused?: boolean;
  mobile?: boolean;
  onRaceComplete?: (result: KartCompletion) => void;
}) {
  const reduced = useReducedMotion();
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
        Get ready. Your phone is the controller; the race appears here when the host
        starts the round.
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
        <div className="kart-viewport">
          <Suspense fallback={<p>Preparing the circuit…</p>}>
            <KartCanvas
              race={race}
              mobile={mobile}
              reducedMotion={Boolean(reduced) || paused}
            />
          </Suspense>
          {paused ? <p className="kart-paused">PAUSED</p> : null}
        </div>
        <aside className="kart-leaderboard" aria-label="Race leaderboard">
          <h3>{race.ended ? "Sprint podium" : "Live race order"}</h3>
          {!race.ended ? (
            <p>
              {race.participants.filter((d) => d.status === "FINISHED").length} /{" "}
              {race.participants.length} laps finished
            </p>
          ) : null}
          <ol>
            {race.leaderboard.slice(0, 8).map((row) => (
              <motion.li
                layout={!reduced}
                key={row.playerId}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <span>{row.place}</span>
                <strong>{row.name}</strong>
                <span>
                  {row.finished
                    ? `${(row.timeMs! / 1000).toFixed(2)}s`
                    : race.ended
                      ? "DNF"
                      : "Racing"}
                  {race.ended ? ` · +${row.points}` : ""}
                </span>
              </motion.li>
            ))}
          </ol>
          {race.leaderboard.length > 8 ? (
            <p>Top 8 of {race.leaderboard.length} drivers</p>
          ) : null}
          <p>
            {race.ended
              ? "DNF scores zero. Equal times share a place."
              : "Hold A · steer on your phone · R to drift. Ghost karts: everyone gets a clear lap."}
          </p>
        </aside>
      </div>
    </section>
  );
}
