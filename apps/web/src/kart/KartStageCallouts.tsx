import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KartRaceView } from "@26/shared";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { stageCallouts, type StageCallout } from "./race-callouts";
import { createRaceAudio, type RaceAudio, type RaceSound } from "./race-audio";
import { hitTickerLines } from "./hit-feed";
import { stageShow } from "../stage/audio";

/** The projector's sound for each call-out. */
const calloutSounds: Record<StageCallout["tone"], RaceSound> = {
  lead: "place-up",
  lap: "lap",
  final: "final-lap",
  finish: "lap",
  win: "finish",
  launch: "launch",
};
/** How long a hit stays in the projector ticker. */
export const tickerMs = 4000;

/** How long each call-out holds the projector. */
export const calloutMs = 2600;

/**
 * The race director on the projector: lead changes, laps and finishers from
 * public frames. Each moment shows once, one at a time, then eases away.
 */
export function KartStageCallouts({
  race,
  audio: injected,
}: {
  race: KartRaceView;
  audio?: RaceAudio;
}) {
  const reduced = usePrefersReducedMotion();
  const [audio] = useState(() => injected ?? createRaceAudio());
  const started = useRef<string | undefined>(undefined);
  const [ticker, setTicker] = useState<{ eventId: number; text: string; at: number }[]>(
    [],
  );
  const tickerSeen = useRef(new Set<number>());
  useEffect(() => () => audio.dispose(), [audio]);
  // The projector can only start sound inside a gesture: Present, F or a click.
  useEffect(() => {
    if (audio.enabled) return;
    const arm = () => {
      audio.enable();
    };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [audio]);
  const play = useCallback(
    (sound: RaceSound) => {
      if (!stageShow.muted) audio.cue(sound);
    },
    [audio],
  );
  const previous = useRef<KartRaceView | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const [queue, setQueue] = useState<StageCallout[]>([]);
  useEffect(() => {
    const fresh = stageCallouts(previous.current, race).filter(
      (callout) => !seen.current.has(callout.id),
    );
    previous.current = race;
    if (started.current !== race.raceId && !race.ended && race.elapsedMs < 3000) {
      started.current = race.raceId;
      play("go");
    }
    const hits = hitTickerLines(race).filter(
      (line) => !tickerSeen.current.has(line.eventId),
    );
    if (hits.length) {
      for (const line of hits) tickerSeen.current.add(line.eventId);
      const at = Date.now();
      setTicker((lines) =>
        [...lines, ...hits.map((line) => ({ ...line, at }))].slice(-3),
      );
      play("launch");
    }
    if (!fresh.length) return;
    play(calloutSounds[fresh.at(-1)!.tone]);
    for (const callout of fresh) seen.current.add(callout.id);
    // A newer lead change replaces an older one still waiting.
    setQueue((waiting) =>
      [
        ...waiting.filter(
          (old) => !(old.tone === "lead" && fresh.some((c) => c.tone === "lead")),
        ),
        ...fresh,
      ].slice(-4),
    );
  }, [race, play]);
  useEffect(() => {
    if (!ticker.length) return;
    const timer = setTimeout(
      () =>
        setTicker((lines) => lines.filter((line) => Date.now() - line.at < tickerMs)),
      tickerMs,
    );
    return () => clearTimeout(timer);
  }, [ticker]);
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((waiting) => waiting.slice(1)), calloutMs);
    return () => clearTimeout(timer);
  }, [current]);
  return (
    <div
      className="kart-stage-callouts"
      role="status"
      aria-live="polite"
      data-idle={current ? undefined : "true"}
    >
      <AnimatePresence initial={false} mode="wait">
        {current ? (
          <motion.p
            key={current.id}
            className="kart-stage-callout"
            data-tone={current.tone}
            initial={{ opacity: 0, y: reduced ? 0 : -16, scale: reduced ? 1 : 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 10 }}
            transition={
              reduced
                ? { duration: 0.15, ease: "easeOut" }
                : { type: "spring", stiffness: 380, damping: 26 }
            }
          >
            {current.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <ul className="kart-hit-ticker" aria-label="Item hits">
        <AnimatePresence initial={false}>
          {ticker.map((line) => (
            <motion.li
              key={line.eventId}
              initial={{ opacity: 0, x: reduced ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.15 : 0.25, ease: "easeOut" }}
            >
              {line.text}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
