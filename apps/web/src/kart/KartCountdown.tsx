import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { LobbySnapshot } from "@26/shared";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { buzz } from "../device/haptics";
import { useRaceCountdown } from "./countdown";

/** Large 3-2-1-GO over the race, on phones and the stage. Display only. */
export function KartCountdown({
  snapshot,
  observedAt,
  haptics = false,
  enabled = true,
}: {
  snapshot: LobbySnapshot;
  observedAt: number;
  haptics?: boolean;
  enabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const beat = useRaceCountdown(snapshot, observedAt, enabled);
  const last = useRef({ beat: null as typeof beat, enabled });
  useEffect(() => {
    const resuming = enabled && !last.current.enabled;
    if (enabled && !resuming && haptics && beat !== null && beat !== last.current.beat)
      buzz(beat === "GO" ? [40, 30, 90] : [18]);
    last.current = { beat, enabled };
  }, [beat, haptics, enabled]);
  return (
    <div
      className="kart-countdown"
      data-active={enabled}
      aria-hidden={!enabled}
      aria-live={enabled ? "assertive" : "off"}
      aria-atomic="true"
    >
      <AnimatePresence>
        {beat !== null ? (
          <motion.span
            key={String(beat)}
            data-beat={beat}
            initial={{ opacity: 0, scale: reduced ? 1 : 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 420, damping: 26 }
            }
          >
            {beat}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
