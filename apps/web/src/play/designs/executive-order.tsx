import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import type { PresentationProps } from "../presentation";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import {
  LiveCount,
  QuestionTag,
  StagePrompt,
  StageVoters,
  useDesignMotion,
  type ChoiceQuestionView,
} from "./kit";
import "./executive-order.css";

/**
 * Executive order: a gold-trimmed decree "on the creation of new countries".
 * Guests tick every country they think was invented, then sign it with a
 * marker scrawl. The reveal stamps each line. Multiple-answer choice only;
 * anything else falls back to the standard view.
 */
export function ExecutiveOrder(props: PresentationProps) {
  const question = props.play.question;
  if (question.kind !== "choice" || question.outcome !== "multiple") {
    return undefined;
  }
  return props.surface === "phone" ? (
    <OrderPhone key={question.id} {...props} question={question} />
  ) : (
    <OrderStage {...props} question={question} />
  );
}

function revealOf(play: PlaySnapshot) {
  return play.reveal?.kind === "choice" ? play.reveal : undefined;
}

function Seal() {
  return (
    <span className="order-seal" aria-hidden="true">
      <span>★</span>
    </span>
  );
}

function Letterhead({ size }: { size: "phone" | "stage" }) {
  return (
    <header className="order-head" data-size={size}>
      <Seal />
      <div>
        <p className="order-office">Department of Brand New Countries</p>
        <p className="order-title">Executive Order No. 26</p>
        <p className="order-sub">On the creation of nations nobody asked for</p>
      </div>
    </header>
  );
}

function Verdict({ made, delay }: { made: boolean; delay: number }) {
  const motionSet = useDesignMotion();
  return (
    <motion.span
      className="order-verdict"
      data-made={made || undefined}
      aria-hidden="true"
      initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 2.2, rotate: -16 }}
      animate={{ opacity: 1, scale: 1, rotate: made ? -9 : 6 }}
      transition={{ ...motionSet.spring, delay: motionSet.delay(delay) }}
    >
      {made ? "100% made up" : "Not him. Just a pun."}
    </motion.span>
  );
}

function Scrawl({ signed }: { signed: boolean }) {
  const motionSet = useDesignMotion();
  return (
    <div className="order-sign">
      <svg viewBox="0 0 220 60" className="order-scrawl" aria-hidden="true">
        <motion.path
          d="M6 44 L22 14 L30 46 L44 10 L52 44 L66 12 L74 46 L90 16 L98 44 L114 10 L122 46 L138 14 L146 44 L162 12 L170 46 L186 18 L214 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: signed ? 1 : 0, opacity: signed ? 1 : 0 }}
          transition={{ duration: motionSet.reduce ? 0.2 : 0.9, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <span className="order-sign-line">Signed, the President (allegedly)</span>
    </div>
  );
}

function OrderPhone({
  play,
  controls,
  question,
}: Extract<PresentationProps, { surface: "phone" }> & { question: ChoiceQuestionView }) {
  const motionSet = useDesignMotion();
  const [draft, setDraft] = useState<string[]>([]);
  const accepted =
    play.selfAnswer?.kind === "multiple" ? play.selfAnswer.optionIds : undefined;
  const chosen = accepted ?? draft;
  const reveal = revealOf(play);
  const correct = reveal?.correctOptionIds ?? [];
  const locked = accepted !== undefined;

  function toggle(id: string) {
    setDraft((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  const status = reveal
    ? "Declassified. See the stamps."
    : locked
      ? "Signed. Tremendous. Watch the stage."
      : controls.pending
        ? "Faxing it to the Oval Office…"
        : chosen.length === 0
          ? "Tick every country he made up, then sign"
          : `${chosen.length} ${chosen.length === 1 ? "country" : "countries"} invented · now sign it`;

  return (
    <section className="design-phone executive-order" aria-label="Your question">
      <QuestionTag play={play}>Top secret-ish</QuestionTag>
      <div className="order-paper">
        <Letterhead size="phone" />
        <h1 className="phone-prompt order-prompt">{play.question.prompt}</h1>
        <p className="order-status" role="status">
          {status}
        </p>
        <ol className="order-list" aria-label="Countries">
          {question.options.map((option, index) => {
            const ticked = chosen.includes(option.id);
            const made = correct.includes(option.id);
            return (
              <motion.li
                key={option.id}
                initial={{ opacity: 0, x: motionSet.move(-16) }}
                animate={{ opacity: reveal && !made ? 0.6 : 1, x: 0 }}
                transition={{ ...motionSet.spring, delay: motionSet.delay(index * 0.08) }}
              >
                <button
                  type="button"
                  className="order-line motion-press"
                  data-ticked={ticked || undefined}
                  aria-pressed={ticked}
                  aria-label={
                    reveal
                      ? `${option.label}, ${made ? "made up by Trump" : "not one of his"}`
                      : option.label
                  }
                  disabled={!controls.open || locked}
                  onClick={() => toggle(option.id)}
                >
                  <span className="order-section" aria-hidden="true">
                    §{index + 1}
                  </span>
                  <span className="order-box" aria-hidden="true">
                    <AnimatePresence>
                      {ticked ? (
                        <motion.svg
                          viewBox="0 0 24 24"
                          className="order-tick"
                          initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.4 }}
                          transition={motionSet.spring}
                        >
                          <motion.path
                            d="M3 13 L9 19 L22 3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: motionSet.reduce ? 1 : 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: motionSet.reduce ? 0 : 0.3 }}
                          />
                        </motion.svg>
                      ) : null}
                    </AnimatePresence>
                  </span>
                  <span className="order-country">{option.label}</span>
                  {reveal ? <Verdict made={made} delay={0.2 + index * 0.15} /> : null}
                </button>
              </motion.li>
            );
          })}
        </ol>
        <Scrawl signed={locked || controls.pending} />
      </div>
      {controls.open || controls.pending || locked ? (
        <SubmitButton
          className={controls.dodge ? "troll-dodge" : ""}
          label="Sign it. Bigly."
          state={roundSubmitState(locked, controls.pending)}
          disabled={!locked && chosen.length === 0}
          onClick={() => controls.onText(JSON.stringify(chosen))}
        />
      ) : null}
    </section>
  );
}

function OrderStage({
  play,
  question,
}: Extract<PresentationProps, { surface: "stage" }> & { question: ChoiceQuestionView }) {
  const motionSet = useDesignMotion();
  const reveal = revealOf(play);
  const correct = reveal?.correctOptionIds ?? [];
  return (
    <div className="design-stage executive-order-stage">
      <QuestionTag play={play}>Executive Order No. 26</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div className="order-paper" data-size="stage">
        <Letterhead size="stage" />
        <ol className="order-list" aria-label="Countries">
          {question.options.map((option, index) => {
            const made = correct.includes(option.id);
            return (
              <motion.li
                key={option.id}
                className="order-line"
                data-size="stage"
                initial={{ opacity: 0, y: motionSet.move(24) }}
                animate={{ opacity: reveal && !made ? 0.55 : 1, y: 0 }}
                transition={{ ...motionSet.spring, delay: motionSet.delay(index * 0.12) }}
              >
                <span className="order-section" aria-hidden="true">
                  §{index + 1}
                </span>
                <span className="order-country">{option.label}</span>
                <StageVoters play={play} optionId={option.id} />
                {reveal ? <Verdict made={made} delay={0.4 + index * 0.35} /> : null}
              </motion.li>
            );
          })}
        </ol>
        <Scrawl signed={reveal !== undefined} />
      </div>
      <p className="design-stage-line">
        {reveal ? (
          <>
            {question.options
              .filter((option) => correct.includes(option.id))
              .map((option) => option.label)
              .join(" and ")}
            . Real quotes. Fake countries. Tremendous.
          </>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="signature in. The best signature."
            many="signatures in. The best signatures."
          />
        )}
      </p>
    </div>
  );
}
