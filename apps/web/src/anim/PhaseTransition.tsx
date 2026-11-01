import { type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

export function PhaseTransition({
  phase,
  children,
  stage = false,
}: {
  phase: string;
  children: ReactNode;
  stage?: boolean;
}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Projected state must change with the server snapshot. Keeping an outgoing
  // question mounted until an exit completes can show the wrong phase heading.
  if (stage)
    return (
      <motion.div
        key={phase}
        data-phase={phase}
        data-phase-motion={reduce ? "fade" : "eased"}
        initial={{ opacity: 0.96, y: reduce ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    );
  return (
    <AnimatePresence mode="wait">
      <PhonePhase key={phase} phase={phase} reduce={reduce}>
        {children}
      </PhonePhase>
    </AnimatePresence>
  );
}

function PhonePhase({
  phase,
  reduce,
  children,
}: {
  phase: string;
  reduce: boolean;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return (
    <motion.fieldset
      disabled={!present}
      aria-hidden={!present || undefined}
      className="m-0 min-w-0 border-0 p-0"
      data-phase={phase}
      data-phase-motion={reduce ? "fade" : "eased"}
      initial={reduce ? { opacity: 0.96, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0.96, y: 0 } : { opacity: 0, y: -8 }}
      transition={{
        duration: reduce ? 0.12 : 0.28,
        ease: [0.2, 0, 0, 1],
      }}
    >
      {children}
    </motion.fieldset>
  );
}
