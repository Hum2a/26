import { Icon } from "@iconify/react/dist/offline";
import bookOpen from "@iconify-icons/lucide/book-open-text";
import { AnimatePresence, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  LiveCount,
  QuestionTag,
  StagePrompt,
  useDesignMotion,
} from "./kit";
import "./scripture.css";

type View = NonNullable<ReturnType<typeof choiceView>>;

/** Verses are lettered by position, so the letter never hints at the answer. */
function verseLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function Scripture(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <ScripturePhone {...props} view={view} />
  ) : (
    <ScriptureStage {...props} view={view} />
  );
}

function ScripturePhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const revealed = view.reveal !== undefined;
  return (
    <section className="design-phone scripture" aria-label="Your question">
      <QuestionTag play={play}>Scripture</QuestionTag>
      <div className="scr-page">
        <p className="scr-book">
          <Icon icon={bookOpen} aria-hidden="true" /> The Book of Leviticus
        </p>
        <h1 className="phone-prompt scr-prompt">{play.question.prompt}</h1>
        <ol className="scr-verses" aria-label="Verses">
          {view.question.options.map((option, index) => {
            const chosen = view.chosen === option.id;
            const answer = view.isAnswer(option.id);
            return (
              <motion.li
                key={option.id}
                initial={{ opacity: 0, y: motionSet.move(10) }}
                animate={{ opacity: revealed && !answer ? 0.4 : 1, y: 0 }}
                transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.08) }}
              >
                <button
                  type="button"
                  className="scr-verse motion-press"
                  data-chosen={chosen || undefined}
                  data-answer={answer || undefined}
                  aria-pressed={chosen}
                  disabled={!controls.open}
                  onClick={() => controls.onSelect(option.id)}
                >
                  <span className="scr-drop" aria-hidden="true">
                    {verseLetter(index)}
                  </span>
                  <span className="scr-text">{option.label}</span>
                  {chosen ? (
                    <motion.span
                      layoutId="scripture-ribbon"
                      className="scr-ribbon"
                      aria-hidden="true"
                      transition={motionSet.spring}
                    />
                  ) : null}
                </button>
              </motion.li>
            );
          })}
        </ol>
        <AnimatePresence>
          {play.explanation ? (
            <motion.blockquote
              className="scr-full"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={motionSet.soft}
            >
              {play.explanation}
            </motion.blockquote>
          ) : null}
        </AnimatePresence>
      </div>
      <ChoiceSend play={play} controls={controls} label="Amen to this one" />
    </section>
  );
}

function ScriptureStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const options = view.question.options;
  const half = Math.ceil(options.length / 2);
  const pages = [options.slice(0, half), options.slice(half)];
  const revealed = view.reveal !== undefined;
  return (
    <div className="design-stage scripture-stage">
      <QuestionTag play={play}>Scripture</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div className="scr-book-spread" aria-label="Verses">
        {pages.map((page, side) => (
          <motion.div
            key={side}
            className="scr-leaf"
            data-side={side === 0 ? "left" : "right"}
            initial={{
              rotateY: motionSet.reduce ? 0 : side === 0 ? 70 : -70,
              opacity: 0,
            }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ ...motionSet.slow, delay: motionSet.delay(0.1) }}
          >
            {page.map((option, row) => {
              const index = side * half + row;
              const answer = view.isAnswer(option.id);
              return (
                <motion.div
                  key={option.id}
                  className="scr-stage-verse"
                  data-answer={answer || undefined}
                  animate={{
                    opacity: revealed && !answer ? 0.28 : 1,
                    scale: answer ? 1.04 : 1,
                  }}
                  transition={{
                    ...motionSet.soft,
                    delay: motionSet.delay(answer ? 0.6 : 0),
                  }}
                >
                  {answer ? (
                    <motion.span
                      className="scr-halo"
                      aria-hidden="true"
                      initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...motionSet.slow, delay: motionSet.delay(0.4) }}
                    />
                  ) : null}
                  <span className="scr-drop">{verseLetter(index)}</span>
                  <span className="scr-text">{option.label}</span>
                </motion.div>
              );
            })}
          </motion.div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {play.explanation ? (
          <motion.blockquote
            key="full"
            className="scr-stage-full"
            initial={{ opacity: 0, y: motionSet.move(20) }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ ...motionSet.slow, delay: motionSet.delay(1) }}
          >
            {play.explanation}
          </motion.blockquote>
        ) : (
          <motion.p
            key="count"
            className="design-stage-line"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            <LiveCount
              value={play.submissionCount}
              one="soul has chosen"
              many="souls have chosen"
            />
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
