import type { CSSProperties } from "react";
import { Icon } from "@iconify/react/dist/offline";
import folderLock from "@iconify-icons/lucide/folder-lock";
import { AnimatePresence, motion } from "motion/react";
import { contentColours } from "../../theme/themes";
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
import "./redacted-file.css";

const inkColours = {
  "--redaction-ink": contentColours.redactionInk,
  "--redaction-text": contentColours.redactionText,
} as CSSProperties;

export function RedactedFile(props: PresentationProps) {
  if (!typedView(props.play)) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <FilePhone {...props} />
  ) : (
    <FileStage {...props} />
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

function FilePhone({
  play,
  controls,
}: Extract<PresentationProps, { surface: "phone" }>) {
  const motionSet = useDesignMotion();
  const typed = useTypedDraft(play, controls);
  const reveal = typedView(play)?.reveal;
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

function FileStage({ play }: Extract<PresentationProps, { surface: "stage" }>) {
  const motionSet = useDesignMotion();
  const reveal = typedView(play)?.reveal;
  const subject = subjectFromPrompt(play.question.prompt);
  return (
    <div className="design-stage dossier-stage" style={inkColours}>
      <QuestionTag play={play}>Case file</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <motion.div
        className="dossier-folder dossier-folder-stage"
        initial={{
          opacity: 0,
          y: motionSet.move(40),
          rotate: motionSet.reduce ? 0 : 1.5,
        }}
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
                initial={false}
                animate={{ scaleX: reveal ? 0 : 1 }}
                transition={{
                  duration: motionSet.reduce ? 0.2 : 1.4,
                  ease: [0.7, 0, 0.2, 1],
                  delay: motionSet.delay(0.6),
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
            one="report filed"
            many="reports filed"
          />
        )}
      </p>
    </div>
  );
}
