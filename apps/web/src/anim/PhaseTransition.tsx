import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

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
        initial={{ opacity: 0.96 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    );
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
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
      </motion.div>
    </AnimatePresence>
  );
}
