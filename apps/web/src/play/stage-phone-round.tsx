import { motion, useReducedMotion } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import "./stage-phone-round.css";

/**
 * The projector while every phone judges its own head-to-heads. It shows the
 * room's progress, never a single pair or anyone's entry, and says what comes
 * next: the best few play a knockout up here.
 */
export function StagePhoneRound({ play }: { play: PlaySnapshot }) {
  const reduced = useReducedMotion();
  const heat = play.ballot?.heat;
  if (!heat) return null;
  const share = heat.total ? Math.min(1, heat.done / heat.total) : 0;
  const entries = play.ballot?.total ?? 0;
  return (
    <div className="stage-phone-round grid gap-6">
      <p className="stage-prompt">{play.question.prompt}</p>
      <motion.h2
        className="stage-answer"
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.4, ease: "easeOut" }}
      >
        Phone round: check your phone
      </motion.h2>
      <p>
        {entries} entries. Every phone gets its own head-to-heads, so every entry gets
        judged. The top {heat.finalists} come up here for the knockout.
      </p>
      <div
        className="stage-phone-round__meter"
        role="progressbar"
        aria-label="Phone round votes"
        aria-valuemin={0}
        aria-valuemax={heat.total}
        aria-valuenow={heat.done}
      >
        <motion.span
          className="stage-phone-round__fill"
          initial={false}
          animate={{ scaleX: share }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 90, damping: 20 }
          }
        />
      </div>
      <p className="stage-phone-round__count">
        {heat.done} of {heat.total} votes in
      </p>
    </div>
  );
}
