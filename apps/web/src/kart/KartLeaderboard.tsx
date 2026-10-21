import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { KartRaceView } from "@26/shared";
import { DriverBadge } from "./DriverBadge";
import { useKartDrivers } from "./drivers-context";

/** Display pagination only. Race order, times and points always come from the server. */
export function KartLeaderboard({
  race,
  paused,
}: {
  race: KartRaceView;
  paused: boolean;
}) {
  const reduced = useReducedMotion();
  const drivers = useKartDrivers();
  const [page, setPage] = useState(0);
  const pages = Math.ceil(Math.max(0, race.leaderboard.length - 5) / 5);
  const current = pages ? page % pages : 0;
  const start = 5 + current * 5;
  useEffect(() => {
    if (pages <= 1 || paused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setPage((value) => (value + 1) % pages);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [pages, paused]);
  const row = (entry: KartRaceView["leaderboard"][number]) => {
    const driver = race.participants.find(
      (driver) => driver.playerId === entry.playerId,
    );
    return (
      <motion.li
        key={entry.playerId}
        layout={!reduced}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.1 : 0.2, ease: "easeOut" }}
      >
        <span className="kart-board-place">{entry.place}</span>
        <strong>
          <DriverBadge
            gameId={drivers.gameId}
            driver={drivers.byPlayer.get(entry.playerId)}
            nickname={entry.name}
            size="1.35em"
          />{" "}
          <small>#{driver?.number ?? "—"}</small> {entry.name}
        </strong>
        <span className="kart-board-result">
          {entry.finished
            ? `${(entry.timeMs! / 1000).toFixed(2)}s`
            : race.ended
              ? "DNF"
              : `${Math.round((driver?.progress ?? 0) * 100)}%`}
          {race.ended ? ` · +${entry.points}` : ""}
        </span>
      </motion.li>
    );
  };
  return (
    <aside className="kart-leaderboard" aria-label="Race leaderboard">
      <header>
        <h3>{race.ended ? "Sprint podium" : "Live race order"}</h3>
        <p>
          {race.leaderboard.length} drivers ·{" "}
          {race.leaderboard.filter((driver) => driver.finished).length} finished
        </p>
      </header>
      <ol aria-label="Race leaders">{race.leaderboard.slice(0, 5).map(row)}</ol>
      {pages ? (
        <div className="kart-field-board">
          <div className="kart-field-heading">
            <h4>
              The field · {start + 1}–{Math.min(start + 5, race.leaderboard.length)}
            </h4>
            {pages > 1 ? (
              <div role="group" aria-label="Browse race field">
                <button
                  type="button"
                  aria-label="Previous drivers"
                  onClick={() => setPage((current + pages - 1) % pages)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next drivers"
                  onClick={() => setPage((current + 1) % pages)}
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
          <AnimatePresence initial={false} mode="wait">
            <motion.ol
              key={current}
              aria-label="Rest of the race field"
              start={start + 1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.1 : 0.2, ease: "easeOut" }}
            >
              {race.leaderboard.slice(start, start + 5).map(row)}
            </motion.ol>
          </AnimatePresence>
          {pages > 1 ? <p>All drivers cycle here every four seconds.</p> : null}
        </div>
      ) : null}
      <p>
        {race.ended
          ? "DNF scores zero. Equal times share a place."
          : "Drive on your phone. Follow the room here."}
      </p>
    </aside>
  );
}
