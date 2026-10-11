import { Icon } from "@iconify/react/dist/offline";
import trash from "@iconify-icons/mdi/trash-can";
import { AnimatePresence, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import {
  LiveCount,
  QuestionTag,
  StagePrompt,
  subjectFromPrompt,
  TypedField,
  TypedSend,
  typedTally,
  typedView,
  useDesignMotion,
  useTypedDraft,
} from "./kit";
import "./bin-unmasked.css";

export function BinUnmasked(props: PresentationProps) {
  if (!typedView(props.play)) {
    return undefined;
  }
  return props.surface === "phone" ? <BinPhone {...props} /> : <BinStage {...props} />;
}

function Candidate({
  unmasked,
  name,
  size,
}: {
  unmasked: boolean;
  name: string | undefined;
  size: "phone" | "stage";
}) {
  const motionSet = useDesignMotion();
  return (
    <div className="bin-candidate" data-size={size}>
      <div className="bin-head">
        <AnimatePresence>
          {unmasked && name ? (
            <motion.p
              className="bin-face"
              initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...motionSet.spring, delay: motionSet.delay(0.7) }}
            >
              {name}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <motion.span
          className="bin-lid"
          aria-hidden="true"
          animate={
            unmasked
              ? {
                  y: motionSet.move(size === "stage" ? -420 : -160),
                  rotate: motionSet.reduce ? 0 : 38,
                  opacity: motionSet.reduce ? 0 : [1, 1, 0],
                }
              : { y: motionSet.reduce ? 0 : [0, -6, 0], rotate: 0, opacity: 1 }
          }
          transition={
            unmasked
              ? {
                  duration: motionSet.reduce ? 0.2 : 1.2,
                  ease: [0.3, 0, 0.2, 1],
                  delay: motionSet.delay(0.2),
                }
              : motionSet.reduce
                ? motionSet.soft
                : {
                    duration: 2.2,
                    repeat: size === "stage" ? Infinity : 0,
                    ease: "easeInOut",
                  }
          }
        >
          <Icon icon={trash} />
        </motion.span>
      </div>
      <div className="bin-body" aria-hidden="true">
        <span className="bin-rosette" />
      </div>
    </div>
  );
}

function BinPhone({
  play,
  controls,
}: Extract<PresentationProps, { surface: "phone" }>) {
  const motionSet = useDesignMotion();
  const typed = useTypedDraft(play, controls);
  const view = typedView(play);
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <section className="design-phone bin" aria-label="Your question">
      <QuestionTag play={play}>Election count</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <Candidate
        unmasked={view?.reveal !== undefined}
        name={view?.reveal?.answer}
        size="phone"
      />
      <div className="bin-form">
        <p className="bin-form-head">Nomination paper · {subject}</p>
        <TypedField
          typed={typed}
          label="Full real name of candidate"
          className="bin-field"
          placeholder="Unmask them…"
        >
          <AnimatePresence>
            {typed.locked ? (
              <motion.span
                className="bin-received"
                initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 1.8, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                transition={motionSet.spring}
              >
                Received
              </motion.span>
            ) : null}
          </AnimatePresence>
        </TypedField>
      </div>
      <TypedSend controls={controls} typed={typed} label="Submit nomination" />
    </section>
  );
}

function BinStage({ play }: Extract<PresentationProps, { surface: "stage" }>) {
  const motionSet = useDesignMotion();
  const view = typedView(play);
  const reveal = view?.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage bin-stage">
      <QuestionTag play={play}>Declaration of the poll</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div className="bin-hall">
        <div
          className="bin-spotlight"
          data-on={reveal ? true : undefined}
          aria-hidden="true"
        />
        <Candidate unmasked={reveal !== undefined} name={reveal?.answer} size="stage" />
        <div className="bin-podium">
          <span className="bin-podium-name">{subject}</span>
        </div>
      </div>
      <p className="design-stage-line">
        {reveal ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(1.4) }}
          >
            {typedTally(reveal)}
            {reveal.correctNames && reveal.correctNames.length > 0
              ? `: ${reveal.correctNames.join(", ")}.`
              : "."}
          </motion.span>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="nomination received"
            many="nominations received"
          />
        )}
      </p>
    </div>
  );
}
