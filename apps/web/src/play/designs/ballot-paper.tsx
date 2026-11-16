import { Icon } from "@iconify/react/dist/offline";
import ballot from "@iconify-icons/mdi/ballot-outline";
import { AnimatePresence, motion } from "motion/react";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  Count,
  LiveCount,
  QuestionTag,
  StagePrompt,
  StageVoters,
  useDesignMotion,
} from "./kit";
import "./ballot-paper.css";

type View = NonNullable<ReturnType<typeof choiceView>>;

/** How many result bars the projector shows before folding the rest into "Others". */
const stageBars = 8;

export function BallotPaper(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <BallotPhone {...props} view={view} />
  ) : (
    <BallotStage {...props} view={view} />
  );
}

function Cross({ drawn }: { drawn: boolean }) {
  const motionSet = useDesignMotion();
  return (
    <svg className="ballot-cross" viewBox="0 0 40 40" aria-hidden="true">
      {["M8 8 L32 32", "M32 8 L8 32"].map((d, stroke) => (
        <motion.path
          key={d}
          d={d}
          initial={false}
          animate={{ pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }}
          transition={{
            duration: motionSet.reduce ? 0.15 : 0.22,
            delay: drawn ? motionSet.delay(stroke * 0.18) : 0,
            ease: "easeOut",
          }}
        />
      ))}
    </svg>
  );
}

function BallotPhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const posted = view.sent !== undefined && !view.reveal;
  return (
    <section className="design-phone ballot" aria-label="Your question">
      <QuestionTag play={play}>Polling station</QuestionTag>
      <motion.div
        className="ballot-sheet"
        animate={{
          scaleY: posted && !motionSet.reduce ? 0.985 : 1,
          opacity: posted ? 0.92 : 1,
        }}
        transition={motionSet.soft}
      >
        <header className="ballot-head">
          <p className="ballot-kicker">Ballot paper</p>
          <h1 className="phone-prompt ballot-prompt">{play.question.prompt}</h1>
          <p className="ballot-rule">
            Vote for <strong>one</strong> only. Put a cross ✗ in the box next to your
            choice.
          </p>
        </header>
        <ol className="ballot-list" aria-label="Parties">
          {view.question.options.map((option, index) => {
            const chosen = view.chosen === option.id;
            const share = view.total > 0 ? view.count(option.id) / view.total : 0;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className="ballot-row motion-press"
                  data-chosen={chosen || undefined}
                  aria-pressed={chosen}
                  disabled={!controls.open}
                  onClick={() => controls.onSelect(option.id)}
                >
                  {view.reveal ? (
                    <motion.span
                      className="ballot-share"
                      aria-hidden="true"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: share }}
                      transition={{
                        ...motionSet.slow,
                        delay: motionSet.delay(index * 0.04),
                      }}
                    />
                  ) : null}
                  <span className="ballot-name">{option.label}</span>
                  {view.reveal ? (
                    <span className="ballot-count">
                      <Count value={view.count(option.id)} />
                    </span>
                  ) : null}
                  <span className="ballot-box" aria-hidden="true">
                    <Cross drawn={chosen} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </motion.div>
      <AnimatePresence>
        {posted ? (
          <motion.p
            className="ballot-posted"
            initial={{ opacity: 0, y: motionSet.move(10) }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            <Icon icon={ballot} aria-hidden="true" /> Folded and in the box.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <ChoiceSend play={play} controls={controls} label="Post my vote" />
    </section>
  );
}

function BallotStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  if (!view.reveal) {
    return (
      <div className="design-stage ballot-stage">
        <QuestionTag play={play}>Polling station</QuestionTag>
        <StagePrompt text={play.question.prompt} />
        <div className="ballot-station">
          <div className="ballot-urn" aria-hidden="true">
            <AnimatePresence>
              {play.submissionCount > 0 ? (
                <motion.span
                  key={play.submissionCount}
                  className="ballot-falling"
                  initial={{ y: motionSet.move(-260), opacity: 0, rotate: -12 }}
                  animate={{ y: motionSet.move(40), opacity: [0, 1, 1, 0], rotate: 6 }}
                  transition={{
                    duration: motionSet.reduce ? 0.2 : 1.1,
                    ease: "easeIn",
                  }}
                />
              ) : null}
            </AnimatePresence>
            <span className="ballot-slot" />
            <Icon icon={ballot} className="ballot-urn-icon" />
          </div>
          <p className="ballot-tally-big">
            <Count value={play.submissionCount} />
            <span>{play.submissionCount === 1 ? "vote cast" : "votes cast"}</span>
          </p>
        </div>
        <ul className="ballot-candidates" aria-label="Parties">
          {view.question.options.map((option) => (
            <li key={option.id}>
              {option.label}
              <StageVoters play={play} optionId={option.id} />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const ranked = [...view.question.options]
    .map((option) => ({ ...option, votes: view.count(option.id) }))
    .sort((left, right) => right.votes - left.votes);
  const top = ranked[0]?.votes ?? 0;
  const leaders = ranked.filter((row) => row.votes === top && top > 0);
  const shown = ranked.slice(0, stageBars);
  const others = ranked.slice(stageBars).reduce((sum, row) => sum + row.votes, 0);
  return (
    <div className="design-stage ballot-stage">
      <QuestionTag play={play}>Election night</QuestionTag>
      <motion.p
        className="ballot-banner"
        initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...motionSet.spring, delay: motionSet.delay(1.6) }}
      >
        {leaders.length === 0
          ? "No votes were cast."
          : leaders.length === 1
            ? `${leaders[0]?.label} wins the room`
            : `Hung parliament: ${leaders.map((row) => row.label).join(" and ")}`}
      </motion.p>
      <ol className="ballot-results" aria-label="Results">
        {shown.map((row, index) => {
          const share = view.total > 0 ? row.votes / view.total : 0;
          const leading = leaders.some((leader) => leader.id === row.id);
          return (
            <motion.li
              key={row.id}
              className="ballot-result"
              data-leading={leading || undefined}
              initial={{ opacity: 0, x: motionSet.move(-30) }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.08) }}
            >
              <span className="ballot-result-name">{row.label}</span>
              <span className="ballot-result-track">
                <motion.span
                  className="ballot-result-bar"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: top > 0 ? row.votes / top : 0 }}
                  transition={{
                    ...motionSet.slow,
                    delay: motionSet.delay(0.4 + index * 0.08),
                  }}
                />
              </span>
              <span className="ballot-result-votes">
                <Count value={row.votes} />
                <small>{Math.round(share * 100)}%</small>
              </span>
              <StageVoters play={play} optionId={row.id} />
            </motion.li>
          );
        })}
      </ol>
      {others > 0 ? (
        <p className="design-stage-line">
          Others: <LiveCount value={others} one="vote" many="votes" />
        </p>
      ) : null}
    </div>
  );
}
