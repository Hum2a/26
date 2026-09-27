import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export function PhaseTransition({
  phase,
  children,
}: {
  phase: string;
  children: ReactNode;
}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        data-phase={phase}
        data-phase-motion={reduce ? "instant" : "eased"}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: reduce ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
