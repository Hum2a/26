import { Icon } from "@iconify/react/dist/offline";
import stamp from "@iconify-icons/lucide/stamp";
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
import "./deed-poll.css";

export function DeedPoll(props: PresentationProps) {
  if (!typedView(props.play)) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <DeedPhone {...props} />
  ) : (
    <DeedStage {...props} />
  );
}

/** Types a name out one letter at a time. Reduced motion fades it in whole. */
function Typewriter({ text, start }: { text: string; start: number }) {
  const motionSet = useDesignMotion();
  if (motionSet.reduce) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={motionSet.soft}
      >
        {text}
      </motion.span>
    );
  }
  return (
    <span aria-label={text}>
      {[...text].map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          aria-hidden="true"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.05, delay: start + index * 0.08 }}
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );
}

function Stamp({
  text,
  delay,
  size,
}: {
  text: string;
  delay: number;
  size: "phone" | "stage";
}) {
  const motionSet = useDesignMotion();
  return (
    <motion.span
      className="deed-stamp"
      data-size={size}
      aria-hidden="true"
      initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 3, rotate: -24 }}
      animate={{ opacity: 0.92, scale: 1, rotate: -10 }}
      transition={{
        type: motionSet.reduce ? "tween" : "spring",
        stiffness: 520,
        damping: 22,
        duration: 0.2,
        delay: motionSet.delay(delay),
      }}
    >
      <Icon icon={stamp} />
      {text}
    </motion.span>
  );
}

function DeedPhone({
  play,
  controls,
}: Extract<PresentationProps, { surface: "phone" }>) {
  const typed = useTypedDraft(play, controls);
  const reveal = typedView(play)?.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <section className="design-phone deed" aria-label="Your question">
      <QuestionTag play={play}>Deed poll</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <div className="deed-paper">
        <p className="deed-title">Change of name deed</p>
        <p className="deed-body">
          I, <strong>{subject}</strong>, absolutely and entirely renounce my former
          name, which was:
        </p>
        <TypedField
          typed={typed}
          label="Former name"
          className="deed-field"
          placeholder="Sign here…"
        />
        <AnimatePresence>
          {typed.locked && !reveal ? (
            <Stamp text="Witnessed" delay={0} size="phone" />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {reveal ? (
            <motion.p
              className="deed-truth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              On record: <Typewriter text={reveal.answer} start={0.3} />
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <TypedSend controls={controls} typed={typed} label="Sign the deed" />
    </section>
  );
}

function DeedStage({ play }: Extract<PresentationProps, { surface: "stage" }>) {
  const motionSet = useDesignMotion();
  const reveal = typedView(play)?.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage deed-stage">
      <QuestionTag play={play}>Deed poll</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="deed-paper deed-paper-stage"
        initial={{
          opacity: 0,
          rotate: motionSet.reduce ? 0 : -2,
          y: motionSet.move(30),
        }}
        animate={{ opacity: 1, rotate: motionSet.reduce ? 0 : -1, y: 0 }}
        transition={motionSet.slow}
      >
        <p className="deed-title">Change of name deed</p>
        <p className="deed-body">
          Now known as <strong>{subject}</strong>.
        </p>
        <p className="deed-body">Formerly known as:</p>
        <p className="deed-former">
          {reveal ? (
            <Typewriter text={reveal.answer} start={motionSet.delay(0.9)} />
          ) : (
            "· · · · · · · · · ·"
          )}
        </p>
        <AnimatePresence>
          {reveal ? <Stamp text="Renounced" delay={0.2} size="stage" /> : null}
        </AnimatePresence>
      </motion.div>
      <p className="design-stage-line">
        {reveal ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(2) }}
          >
            {typedTally(reveal)}
            {reveal.correctNames && reveal.correctNames.length > 0
              ? `: ${reveal.correctNames.join(", ")}.`
              : "."}
          </motion.span>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="signature witnessed"
            many="signatures witnessed"
          />
        )}
      </p>
    </div>
  );
}
