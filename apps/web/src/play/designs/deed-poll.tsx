import { Icon } from "@iconify/react/dist/offline";
import stamp from "@iconify-icons/lucide/stamp";
import { AnimatePresence, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  LiveCount,
  QuestionTag,
  StagePrompt,
  StageVoters,
  subjectFromPrompt,
  TypedField,
  TypedSend,
  typedTally,
  typedView,
  useDesignMotion,
  useTypedDraft,
} from "./kit";
import "./deed-poll.css";

type ChoiceView = NonNullable<ReturnType<typeof choiceView>>;
type TypedView = NonNullable<ReturnType<typeof typedView>>;

export function DeedPoll(props: PresentationProps) {
  const choice = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (choice) {
    return props.surface === "phone" ? (
      <DeedChoicePhone {...props} view={choice} />
    ) : (
      <DeedChoiceStage {...props} view={choice} />
    );
  }
  const typed = typedView(props.play);
  if (!typed) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <DeedPhone {...props} view={typed} />
  ) : (
    <DeedStage {...props} view={typed} />
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
  const chars = [...text];
  const step = chars.length > 0 ? Math.min(0.06, 0.9 / chars.length) : 0.06;
  return (
    <span aria-label={text}>
      {chars.map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          aria-hidden="true"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.05, delay: start + index * step }}
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
  inline = false,
}: {
  text: string;
  delay: number;
  size: "phone" | "stage";
  inline?: boolean;
}) {
  const motionSet = useDesignMotion();
  return (
    <motion.span
      className={inline ? "deed-stamp deed-stamp-inline" : "deed-stamp"}
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

function DeedChoicePhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: ChoiceView }) {
  const motionSet = useDesignMotion();
  const subject = subjectFromPrompt(play.question.prompt);
  const winner = view.question.options.find((option) => view.isAnswer(option.id));
  const revealed = view.reveal !== undefined;
  const locked = view.sent !== undefined;
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
        <ul className="deed-options" aria-label="Former names">
          {view.question.options.map((option, index) => {
            const chosen = view.chosen === option.id;
            const isWinner = view.isAnswer(option.id);
            return (
              <motion.li
                key={option.id}
                initial={{ opacity: 0, y: motionSet.move(10) }}
                animate={{ opacity: revealed && !isWinner ? 0.42 : 1, y: 0 }}
                transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.05) }}
              >
                <button
                  type="button"
                  className="deed-option motion-press"
                  data-chosen={chosen || undefined}
                  data-winner={isWinner || undefined}
                  aria-pressed={chosen}
                  disabled={!controls.open}
                  onClick={() => controls.onSelect(option.id)}
                >
                  <span className="deed-option-seal" aria-hidden="true">
                    {chosen ? "✓" : ""}
                  </span>
                  <span className="deed-option-name">{option.label}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
        <AnimatePresence>
          {locked && !winner ? (
            <div className="deed-seal-row">
              <Stamp text="Witnessed" delay={0} size="phone" inline />
            </div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {winner ? (
            <motion.p
              className="deed-truth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              On record: <Typewriter text={winner.label} start={0.3} />
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <ChoiceSend play={play} controls={controls} label="Sign the deed" />
    </section>
  );
}

function DeedChoiceStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: ChoiceView }) {
  const motionSet = useDesignMotion();
  const winner = view.question.options.find((option) => view.isAnswer(option.id));
  const revealed = view.reveal !== undefined;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage deed-stage">
      <QuestionTag play={play}>Deed poll</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="deed-paper deed-paper-stage"
        initial={
          revealed
            ? false
            : {
                opacity: 0,
                rotate: motionSet.reduce ? 0 : -2,
                y: motionSet.move(30),
              }
        }
        animate={{ opacity: 1, rotate: motionSet.reduce ? 0 : -1, y: 0 }}
        transition={motionSet.slow}
      >
        <p className="deed-title">Change of name deed</p>
        <p className="deed-body">
          Now known as <strong>{subject}</strong>.
        </p>
        <p className="deed-body">Formerly known as:</p>
        <p className="deed-former">
          {winner ? (
            <Typewriter text={winner.label} start={motionSet.delay(0.3)} />
          ) : (
            "· · · · · · · · · ·"
          )}
        </p>
        <ul className="deed-stage-options" aria-label="Former names">
          {view.question.options.map((option) => {
            const isWinner = winner?.id === option.id;
            return (
              <li
                key={option.id}
                className="deed-stage-option"
                data-winner={isWinner || undefined}
                data-dimmed={(revealed && !isWinner) || undefined}
              >
                <span className="deed-stage-option-name">{option.label}</span>
                <StageVoters play={play} optionId={option.id} />
              </li>
            );
          })}
        </ul>
        <AnimatePresence>
          {winner ? <Stamp text="Renounced" delay={1.05} size="stage" /> : null}
        </AnimatePresence>
      </motion.div>
      <p className="design-stage-line">
        {winner ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(1.15) }}
          >
            Renounced: {winner.label}.
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

function DeedPhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: TypedView }) {
  const typed = useTypedDraft(play, controls);
  const reveal = view.reveal;
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

function DeedStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: TypedView }) {
  const motionSet = useDesignMotion();
  const reveal = view.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage deed-stage">
      <QuestionTag play={play}>Deed poll</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="deed-paper deed-paper-stage"
        initial={
          reveal
            ? false
            : {
                opacity: 0,
                rotate: motionSet.reduce ? 0 : -2,
                y: motionSet.move(30),
              }
        }
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
            <Typewriter text={reveal.answer} start={motionSet.delay(0.3)} />
          ) : (
            "· · · · · · · · · ·"
          )}
        </p>
        <AnimatePresence>
          {reveal ? <Stamp text="Renounced" delay={1.05} size="stage" /> : null}
        </AnimatePresence>
      </motion.div>
      <p className="design-stage-line">
        {reveal ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(1.35) }}
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
