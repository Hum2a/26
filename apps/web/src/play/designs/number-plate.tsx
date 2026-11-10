import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  LiveCount,
  QuestionTag,
  StagePrompt,
  StageVoters,
  useDesignMotion,
} from "./kit";
import "./number-plate.css";

type View = NonNullable<ReturnType<typeof choiceView>>;

export function NumberPlate(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <PlatePhone {...props} view={view} />
  ) : (
    <PlateStage {...props} view={view} />
  );
}

function Plate({ label, size = "phone" }: { label: string; size?: "phone" | "stage" }) {
  return (
    <span className="plate" data-size={size}>
      <span className="plate-band" aria-hidden="true">
        <span className="plate-stars">✶</span>
        UK
      </span>
      <span className="plate-text">{label}</span>
    </span>
  );
}

function PlatePhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const revealed = view.reveal !== undefined;
  return (
    <section className="design-phone number-plate" aria-label="Your question">
      <QuestionTag play={play}>DVLA</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <ul className="plate-rack" aria-label="Names">
        {view.question.options.map((option, index) => {
          const chosen = view.chosen === option.id;
          const answer = view.isAnswer(option.id);
          return (
            <li key={option.id}>
              <motion.button
                type="button"
                className="plate-button motion-press"
                data-chosen={chosen || undefined}
                aria-pressed={chosen}
                aria-label={answer ? `${option.label}, the answer` : option.label}
                disabled={!controls.open}
                onClick={() => controls.onSelect(option.id)}
                initial={{ opacity: 0, y: motionSet.move(18) }}
                animate={{
                  opacity: revealed && !answer ? 0.35 : 1,
                  y: chosen && !revealed ? motionSet.move(-4) : 0,
                  rotate: answer && !motionSet.reduce ? [0, -2, 1.5, 0] : 0,
                }}
                transition={{
                  ...motionSet.spring,
                  delay: motionSet.delay(index * 0.07),
                }}
              >
                <Plate label={option.label} />
                <AnimatePresence>
                  {chosen ? (
                    <>
                      {["left", "right"].map((side) => (
                        <motion.span
                          key={side}
                          className="plate-screw"
                          data-side={side}
                          aria-hidden="true"
                          initial={{
                            opacity: 0,
                            rotate: motionSet.reduce ? 0 : -180,
                            scale: 0.4,
                          }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.4 }}
                          transition={motionSet.spring}
                        />
                      ))}
                    </>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>
                  {answer ? (
                    <motion.span
                      className="plate-stamp"
                      aria-hidden="true"
                      initial={{
                        opacity: 0,
                        scale: motionSet.reduce ? 1 : 2.4,
                        rotate: -14,
                      }}
                      animate={{ opacity: 1, scale: 1, rotate: -8 }}
                      transition={{ ...motionSet.spring, delay: motionSet.delay(0.3) }}
                    >
                      Registered
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.button>
            </li>
          );
        })}
      </ul>
      <ChoiceSend play={play} controls={controls} label="Register this name" />
    </section>
  );
}

function PlateStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const answer = view.question.options.find((option) => view.isAnswer(option.id));
  return (
    <div className="design-stage number-plate-stage">
      <QuestionTag play={play}>DVLA</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <LayoutGroup>
        <div className="car" aria-hidden="true">
          <div className="car-roof" />
          <div className="car-body">
            <motion.span
              className="car-light"
              data-side="left"
              animate={answer ? { opacity: [0.5, 1, 0.6, 1] } : { opacity: 0.55 }}
              transition={{
                duration: motionSet.reduce ? 0.2 : 1.2,
                delay: motionSet.delay(0.8),
              }}
            />
            <div className="car-holder">
              {answer ? (
                <motion.div layoutId={`plate-${answer.id}`} transition={motionSet.slow}>
                  <Plate label={answer.label} size="stage" />
                </motion.div>
              ) : (
                <motion.span
                  className="car-holder-empty"
                  animate={
                    motionSet.reduce ? { opacity: 0.7 } : { opacity: [0.35, 0.8, 0.35] }
                  }
                  transition={
                    motionSet.reduce
                      ? motionSet.soft
                      : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  ??? ????
                </motion.span>
              )}
            </div>
            <motion.span
              className="car-light"
              data-side="right"
              animate={answer ? { opacity: [0.5, 1, 0.6, 1] } : { opacity: 0.55 }}
              transition={{
                duration: motionSet.reduce ? 0.2 : 1.2,
                delay: motionSet.delay(0.8),
              }}
            />
          </div>
          <div className="car-wheels">
            <span />
            <span />
          </div>
        </div>
        <ul className="plate-row" aria-label="Names">
          {view.question.options.map((option, index) =>
            option.id === answer?.id ? (
              <li key={option.id} className="plate-row-gap" />
            ) : (
              <motion.li
                key={option.id}
                layoutId={`plate-${option.id}`}
                initial={{ opacity: 0, y: motionSet.move(30) }}
                animate={{ opacity: answer ? 0.3 : 1, y: 0 }}
                transition={{
                  ...motionSet.spring,
                  delay: motionSet.delay(index * 0.1),
                }}
              >
                <Plate label={option.label} size="stage" />
                <StageVoters play={play} optionId={option.id} />
              </motion.li>
            ),
          )}
        </ul>
      </LayoutGroup>
      <p className="design-stage-line">
        {answer ? (
          <>Registered: {answer.label}.</>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="application in"
            many="applications in"
          />
        )}
      </p>
    </div>
  );
}
