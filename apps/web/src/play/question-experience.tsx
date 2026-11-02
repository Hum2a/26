import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import type { LobbySnapshot } from "@26/shared";
import "./question-experience.css";
import { answerStatus, questionDirection } from "./question-direction";

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
  const status = answerStatus(snapshot, pending);
  const answered = play.submissionCount;
  const players = snapshot.players?.length ?? 0;
  const progress =
    play.question.total > 0 ? play.question.index / play.question.total : 0;
  const revealed = snapshot.phase === "reveal" || snapshot.phase === "scores";
  const award = play.selfAward;
  const result =
    revealed && status === "accepted" && award !== null
      ? award > 0
        ? {
            tone: "won",
            title: `+${award} points`,
            line: "Nice. Check Ranks for your place.",
          }
        : { tone: "missed", title: "No points this time", line: "Plenty more to come." }
      : revealed && status === "closed" && play.question.kind !== "kart"
        ? {
            tone: "missed",
            title: "No answer from you",
            line: "Get the next one in time.",
          }
        : null;
  return (
    <section
      className="question-experience"
      data-kind={play.question.kind}
      data-phase={snapshot.phase}
      data-answer={status}
      aria-label="Question experience"
    >
      <header className="question-direction">
        <span
          className="question-progress glass"
          style={{ "--progress": `${progress * 100}%` } as CSSProperties}
        >
          <span className="sr-only">Question </span>
          {play.question.index}
          <small aria-hidden="true">/{play.question.total}</small>
          <span className="sr-only"> of {play.question.total}</span>
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            key={cue}
            role="status"
            className="question-cue"
            initial={{ opacity: 0.5, y: reduce ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {cue}
          </motion.p>
        </AnimatePresence>
      </header>
      <AnimatePresence initial={false}>
        {status === "accepted" || status === "sending" || result ? (
          <motion.div
            key={result ? `result-${result.tone}` : "answer-state"}
            className="answer-state glass"
            data-state={result?.tone ?? status}
            initial={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8 }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 460, damping: 32 }
            }
          >
            <span className="answer-state-mark" aria-hidden="true">
              {result?.tone === "missed" ? (
                <span className="answer-state-glyph">–</span>
              ) : result ? (
                <span className="answer-state-glyph">★</span>
              ) : status === "accepted" ? (
                <motion.svg viewBox="0 0 24 24">
                  <motion.path
                    d="M5 12.5l4.2 4.2L19 7"
                    initial={{ pathLength: reduce ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: reduce ? 0 : 0.35,
                      delay: reduce ? 0 : 0.1,
                    }}
                  />
                </motion.svg>
              ) : (
                <span className="answer-state-spinner" />
              )}
            </span>
            <span className="answer-state-text">
              <strong>
                {result
                  ? result.title
                  : status === "accepted"
                    ? "Locked in"
                    : "Sending…"}
              </strong>
              <span>
                {result
                  ? result.line
                  : status === "accepted"
                    ? revealed
                      ? "Your answer is in. See the stage for the result."
                      : "The room has your answer. Watch the stage."
                    : "Hold on while the room confirms it."}
              </span>
            </span>
            {players > 0 && !revealed ? (
              <span
                className="answer-state-count"
                aria-label={`${answered} of ${players} answered`}
              >
                {answered}
                <small>/{players}</small>
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="question-experience-body">{children}</div>
    </section>
  );
}
