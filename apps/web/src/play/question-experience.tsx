import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { LobbySnapshot } from "@26/shared";
import "./question-experience.css";
import { questionDirection } from "./question-direction";

/** The shared phone stage. Bespoke designs own their visual inside this frame. */
export function QuestionExperience({
  snapshot,
  pending,
  children,
}: {
  snapshot: LobbySnapshot;
  pending: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const play = snapshot.play;
  if (!play) return null;
  const cue = questionDirection(snapshot, pending);
  return (
    <section
      className="question-experience"
      data-kind={play.question.kind}
      data-phase={snapshot.phase}
      aria-label="Question experience"
    >
      <header className="question-direction">
        <span className="question-progress">
          {play.question.index} / {play.question.total}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            key={cue}
            role="status"
            initial={{ opacity: 0.5, y: reduce ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {cue}
          </motion.p>
        </AnimatePresence>
      </header>
      <div className="question-experience-body">{children}</div>
    </section>
  );
}
