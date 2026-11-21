import type { CSSProperties } from "react";
import { Icon } from "@iconify/react/dist/offline";
import folderLock from "@iconify-icons/lucide/folder-lock";
import { AnimatePresence, motion } from "motion/react";
import { contentColours } from "../../theme/themes";
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
import "./redacted-file.css";

type ChoiceView = NonNullable<ReturnType<typeof choiceView>>;
type TypedView = NonNullable<ReturnType<typeof typedView>>;

const inkColours = {
  "--redaction-ink": contentColours.redactionInk,
  "--redaction-text": contentColours.redactionText,
} as CSSProperties;

export function RedactedFile(props: PresentationProps) {
  const choice = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (choice) {
    return props.surface === "phone" ? (
      <FileChoicePhone {...props} view={choice} />
    ) : (
      <FileChoiceStage {...props} view={choice} />
    );
  }
  const typed = typedView(props.play);
  if (!typed) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <FilePhone {...props} view={typed} />
  ) : (
    <FileStage {...props} view={typed} />
  );
}

/** A case number from the question id, so each file looks official without meaning anything. */
function caseNumber(id: string): string {
  let hash = 0;
  for (const letter of id) {
    hash = (hash * 31 + letter.charCodeAt(0)) % 100000;
  }
  return `CASE ${String(hash).padStart(5, "0")}`;
}

function FileChoicePhone({
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
    <section
      className="design-phone dossier"
      style={inkColours}
      aria-label="Your question"
    >
      <QuestionTag play={play}>Case file</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <div className="dossier-folder">
        <span className="dossier-tab">
          <Icon icon={folderLock} aria-hidden="true" /> {caseNumber(play.question.id)}
        </span>
        <dl className="dossier-fields">
          <div>
            <dt>Alias</dt>
            <dd>{subject}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{revealed ? "Declassified" : "Classified"}</dd>
          </div>
        </dl>
        <ul className="dossier-options" aria-label="Possible names">
          {view.question.options.map((option, index) => {
            const chosen = view.chosen === option.id;
            const isWinner = view.isAnswer(option.id);
            return (
              <motion.li
                key={option.id}
                initial={{ opacity: 0, y: motionSet.move(8) }}
                animate={{ opacity: revealed && !isWinner ? 0.45 : 1, y: 0 }}
                transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.05) }}
              >
                <button
                  type="button"
                  className="dossier-option motion-press"
                  data-chosen={chosen || undefined}
                  data-winner={isWinner || undefined}
                  aria-pressed={chosen}
                  disabled={!controls.open}
                  onClick={() => controls.onSelect(option.id)}
                >
                  <span className="dossier-option-tag" aria-hidden="true">
                    {chosen ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="dossier-option-name">{option.label}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
        <AnimatePresence>
          {locked && !revealed ? (
            <motion.span
              className="dossier-stamp"
              initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 2.2, rotate: -20 }}
              animate={{ opacity: 0.9, scale: 1, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={motionSet.spring}
            >
              Filed
            </motion.span>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {winner ? (
            <motion.p
              className="dossier-truth"
              initial={{ opacity: 0, y: motionSet.move(8) }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={motionSet.soft}
            >
              On file: <strong>{winner.label}</strong>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <ChoiceSend play={play} controls={controls} label="Submit to the file" />
    </section>
  );
}

function FileChoiceStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: ChoiceView }) {
  const motionSet = useDesignMotion();
  const winner = view.question.options.find((option) => view.isAnswer(option.id));
  const revealed = view.reveal !== undefined;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage dossier-stage" style={inkColours}>
      <QuestionTag play={play}>Case file</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="dossier-folder dossier-folder-stage"
        initial={
          revealed
            ? false
            : {
                opacity: 0,
                y: motionSet.move(40),
                rotate: motionSet.reduce ? 0 : 1.5,
              }
        }
        animate={{ opacity: 1, y: 0, rotate: motionSet.reduce ? 0 : 0.5 }}
        transition={motionSet.slow}
      >
        <span className="dossier-tab">
          <Icon icon={folderLock} aria-hidden="true" /> {caseNumber(play.question.id)}
        </span>
        <motion.span
          className="dossier-classified"
          aria-hidden="true"
          animate={{ opacity: revealed ? 0.25 : 0.85, rotate: -12 }}
          transition={motionSet.soft}
        >
          {revealed ? "Declassified" : "Classified"}
        </motion.span>
        <dl className="dossier-fields">
          <div>
            <dt>Alias</dt>
            <dd>{subject}</dd>
          </div>
          <div>
            <dt>Real name</dt>
            <dd className="dossier-redaction">
              <span className="dossier-name">
                {winner ? winner.label : "Not for release"}
              </span>
              <motion.span
                className="dossier-bar"
                aria-hidden="true"
                initial={revealed ? { scaleX: motionSet.reduce ? 0 : 1 } : false}
                animate={{ scaleX: revealed ? 0 : 1 }}
                transition={{
                  duration: motionSet.reduce ? 0.2 : 1.1,
                  ease: [0.7, 0, 0.2, 1],
                  delay: motionSet.delay(0.35),
                }}
              />
            </dd>
          </div>
        </dl>
        <ul className="dossier-stage-options" aria-label="Possible names">
          {view.question.options.map((option) => {
            const isWinner = winner?.id === option.id;
            return (
              <li
                key={option.id}
                className="dossier-stage-option"
                data-winner={isWinner || undefined}
                data-dimmed={(revealed && !isWinner) || undefined}
              >
                <span className="dossier-stage-option-name">{option.label}</span>
                <StageVoters play={play} optionId={option.id} />
              </li>
            );
          })}
        </ul>
      </motion.div>
      <p className="design-stage-line">
        {winner ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(1.15) }}
          >
            Declassified: {winner.label}.
          </motion.span>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="report filed"
            many="reports filed"
          />
        )}
      </p>
    </div>
  );
}

function FilePhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: TypedView }) {
  const motionSet = useDesignMotion();
  const typed = useTypedDraft(play, controls);
  const reveal = view.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <section
      className="design-phone dossier"
      style={inkColours}
      aria-label="Your question"
    >
      <QuestionTag play={play}>Case file</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <div className="dossier-folder">
        <span className="dossier-tab">
          <Icon icon={folderLock} aria-hidden="true" /> {caseNumber(play.question.id)}
        </span>
        <dl className="dossier-fields">
          <div>
            <dt>Alias</dt>
            <dd>{subject}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{reveal ? "Declassified" : "Classified"}</dd>
          </div>
        </dl>
        <TypedField
          typed={typed}
          label="Real name"
          className="dossier-field"
          placeholder="████████"
        />
        <AnimatePresence>
          {typed.locked && !reveal ? (
            <motion.span
              className="dossier-stamp"
              initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 2.2, rotate: -20 }}
              animate={{ opacity: 0.9, scale: 1, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={motionSet.spring}
            >
              Filed
            </motion.span>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {reveal ? (
            <motion.p
              className="dossier-truth"
              initial={{ opacity: 0, y: motionSet.move(8) }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={motionSet.soft}
            >
              On file: <strong>{reveal.answer}</strong>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <TypedSend controls={controls} typed={typed} label="Submit to the file" />
    </section>
  );
}

function FileStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: TypedView }) {
  const motionSet = useDesignMotion();
  const reveal = view.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage dossier-stage" style={inkColours}>
      <QuestionTag play={play}>Case file</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="dossier-folder dossier-folder-stage"
        initial={
          reveal
            ? false
            : {
                opacity: 0,
                y: motionSet.move(40),
                rotate: motionSet.reduce ? 0 : 1.5,
              }
        }
        animate={{ opacity: 1, y: 0, rotate: motionSet.reduce ? 0 : 0.5 }}
        transition={motionSet.slow}
      >
        <span className="dossier-tab">
          <Icon icon={folderLock} aria-hidden="true" /> {caseNumber(play.question.id)}
        </span>
        <motion.span
          className="dossier-classified"
          aria-hidden="true"
          animate={{ opacity: reveal ? 0.25 : 0.85, rotate: -12 }}
          transition={motionSet.soft}
        >
          {reveal ? "Declassified" : "Classified"}
        </motion.span>
        <dl className="dossier-fields">
          <div>
            <dt>Alias</dt>
            <dd>{subject}</dd>
          </div>
          <div>
            <dt>Real name</dt>
            <dd className="dossier-redaction">
              <span className="dossier-name">
                {reveal ? reveal.answer : "Not for release"}
              </span>
              <motion.span
                className="dossier-bar"
                aria-hidden="true"
                initial={reveal ? { scaleX: motionSet.reduce ? 0 : 1 } : false}
                animate={{ scaleX: reveal ? 0 : 1 }}
                transition={{
                  duration: motionSet.reduce ? 0.2 : 1.1,
                  ease: [0.7, 0, 0.2, 1],
                  delay: motionSet.delay(0.35),
                }}
              />
            </dd>
          </div>
        </dl>
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
            one="report filed"
            many="reports filed"
          />
        )}
      </p>
    </div>
  );
}
