import { AnimatePresence, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import { ChoiceSend, choiceView, LiveCount, useDesignMotion } from "./kit";
import "./who-said-it.css";

/** The quote is public prompt copy; its attribution comes only from a server reveal. */
export function WhoSaidIt(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  const motionSet = useDesignMotion();
  if (!view) return undefined;
  const phone = props.surface === "phone";
  const answer = view.reveal
    ? view.question.options.find((o) => view.isAnswer(o.id))
    : undefined;
  return (
    <section
      className={
        phone
          ? "design-phone who-said-it"
          : "design-stage who-said-it who-said-it-stage"
      }
      aria-label="Who said it question"
    >
      <h1 className={phone ? "phone-prompt" : "who-said-it-title"}>Who said it?</h1>
      <motion.blockquote
        className="who-said-it-quote"
        initial={{ opacity: 0, y: motionSet.move(8) }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionSet.soft}
      >
        {view.question.prompt}
      </motion.blockquote>
      <div className="who-said-it-options" role="group" aria-label="Choose a source">
        {view.question.options.map((option, index) => {
          const chosen = view.chosen === option.id;
          const correct = Boolean(view.reveal && view.isAnswer(option.id));
          const content = (
            <>
              <span className="who-said-it-letter" aria-hidden="true">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option.label}</span>
              {view.reveal ? (
                <span className="who-said-it-result">
                  {correct ? "Correct · " : ""}
                  {view.count(option.id)} votes
                </span>
              ) : null}
            </>
          );
          return phone ? (
            <motion.button
              key={option.id}
              type="button"
              className="who-said-it-option motion-press"
              aria-pressed={chosen}
              disabled={!props.controls.open}
              data-chosen={chosen || undefined}
              data-correct={correct || undefined}
              onClick={() => props.controls.onSelect(option.id)}
              initial={{ opacity: 0, y: motionSet.move(8) }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.06) }}
            >
              {content}
            </motion.button>
          ) : (
            <motion.div
              key={option.id}
              className="who-said-it-option"
              data-correct={correct || undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={motionSet.soft}
            >
              {content}
            </motion.div>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {view.reveal && answer ? (
          <motion.p
            key="answer"
            className="who-said-it-verdict"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            It was {answer.label}.
          </motion.p>
        ) : null}
      </AnimatePresence>
      {phone ? (
        <ChoiceSend play={props.play} controls={props.controls} label="Send choice" />
      ) : !view.reveal ? (
        <p className="design-stage-line">
          <LiveCount
            value={props.play.submissionCount}
            one="choice locked in"
            many="choices locked in"
          />
        </p>
      ) : null}
    </section>
  );
}
