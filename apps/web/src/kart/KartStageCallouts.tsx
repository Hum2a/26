import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KartRaceView } from "@26/shared";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { stageCallouts, type StageCallout } from "./race-callouts";

/** How long each call-out holds the projector. */
export const calloutMs = 2600;

/**
 * The race director on the projector: lead changes, laps and finishers from
 * public frames. Each moment shows once, one at a time, then eases away.
 */
export function KartStageCallouts({ race }: { race: KartRaceView }) {
  const reduced = usePrefersReducedMotion();
  const previous = useRef<KartRaceView | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const [queue, setQueue] = useState<StageCallout[]>([]);
  useEffect(() => {
    const fresh = stageCallouts(previous.current, race).filter(
      (callout) => !seen.current.has(callout.id),
    );
    previous.current = race;
    if (!fresh.length) return;
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
  }, [race]);
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
    </div>
  );
}
