import { AnimatePresence, motion } from "motion/react";
import { kartTrialQuality, type KartTrial } from "@26/shared";
import "./time-trial.css";
import { Button } from "../ui/primitives";
import { trialTime } from "./trial-time";

/** Actual practice HUD/results, also used by the labelled isolated Admin rehearsal. */
export function KartTimeTrial({
  trial,
  paused,
  onRestart,
}: {
  trial: KartTrial;
  paused: boolean;
  onRestart: () => void;
}) {
  const quality = kartTrialQuality(trial);
  const beat = trial.finished
    ? "finished"
    : paused
      ? "paused"
      : trial.startedMs === null
        ? "waiting"
        : "driving";
  return (
    <section className="kart-time-trial" aria-label="Time trial" data-state={beat}>
      <div className="kart-trial-metrics">
        <output aria-label="Trial time" aria-live="off">
          {trialTime(trial.elapsedMs)}
        </output>
        <span>
          Lap {Math.min(trial.config.laps, trial.laps.length + 1)} / {trial.config.laps}{" "}
          · Sector {Math.min(8, trial.cursor.checkpoint + 1)} / 8
        </span>
        <span>
          {quality === "clean"
            ? "Clean run"
            : quality === "assisted"
              ? "Assisted run"
              : "Invalid run — no record"}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${beat}-${trial.notice}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          role="status"
        >
          {paused && !trial.finished ? "Paused — trial clock stopped" : trial.notice}
        </motion.p>
      </AnimatePresence>
      {trial.finished ? (
        <motion.div
          className="kart-trial-results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <h2>Trial complete</h2>
          <p>
            Total {trialTime(trial.elapsedMs)} · Best lap{" "}
            {trialTime(Math.min(...trial.laps.map((lap) => lap.timeMs)))}
          </p>
          <ol aria-label="Lap splits">
            {trial.laps.map((lap, index) => (
              <li key={index}>
                Lap {index + 1}: {trialTime(lap.timeMs)} · {lap.quality}
                <span>Sector splits</span>
                <ol>
                  {lap.sectorsMs.map((time, sector) => (
                    <li key={sector}>
                      Sector {sector + 1}: {trialTime(time)}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <Button type="button" onClick={onRestart}>
            Restart trial
          </Button>
        </motion.div>
      ) : null}
    </section>
  );
}
