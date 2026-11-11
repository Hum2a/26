import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { contentColours } from "../../theme/themes";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  LiveCount,
  QuestionTag,
  StageVoters,
  useDesignMotion,
} from "./kit";
import "./whos-that-pokemon.css";

type View = NonNullable<ReturnType<typeof choiceView>>;

/** The bumper's own colours: the same red burst and yellow title in every theme. */
const sceneColours = {
  "--poke-red": contentColours.pokeRed,
  "--poke-red-deep": contentColours.pokeRedDeep,
  "--poke-yellow": contentColours.pokeYellow,
  "--poke-blue": contentColours.pokeBlue,
  "--poke-ink": contentColours.pokeInk,
  "--poke-cream": contentColours.pokeCream,
  "--poke-burst": contentColours.pokeBurst,
} as CSSProperties;

/**
 * The blacked-out picture sits beside the question's other pictures, under a
 * neutral name. It is a separate file, not the answer's picture darkened in
 * the browser, so nothing here names the answer before the reveal.
 */
function silhouetteSrc(questionId: string): string {
  return `/assets/questions/${questionId}/silhouette.png`;
}

/**
 * "Who's that Pokémon?": a blacked-out silhouette in a burst, four names in a
 * battle-menu box, and the colour picture flashing in at the reveal.
 */
export function WhosThatPokemon(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <PokePhone {...props} view={view} />
  ) : (
    <PokeStage {...props} view={view} />
  );
}

function answerOf(view: View) {
  return view.reveal
    ? view.question.options.find((option) => view.isAnswer(option.id))
    : undefined;
}

/** The mystery picture: black until the room reveals it, then the answer in colour. */
function Mystery({ view, size }: { view: View; size: "phone" | "stage" }) {
  const motionSet = useDesignMotion();
  const [missing, setMissing] = useState(false);
  const answer = answerOf(view);
  const colour = answer?.image;
  return (
    <div
      className="poke-mystery"
      data-size={size}
      data-revealed={answer ? "" : undefined}
    >
      <span className="poke-rays" aria-hidden="true" />
      <span className="poke-glow" aria-hidden="true" />
      <AnimatePresence mode="wait" initial={false}>
        {colour ? (
          <motion.img
            key="colour"
            className="poke-art"
            src={colour}
            alt={answer.label}
            decoding="async"
            draggable={false}
            initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={motionSet.spring}
          />
        ) : missing ? (
          <motion.span
            key="unknown"
            className="poke-unknown"
            role="img"
            aria-label="A mystery Pokémon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            ?
          </motion.span>
        ) : (
          <motion.img
            key="silhouette"
            className="poke-art"
            src={silhouetteSrc(view.question.id)}
            alt="A blacked-out Pokémon"
            decoding="async"
            draggable={false}
            onError={() => setMissing(true)}
            initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {answer ? (
          <motion.span
            key="flash"
            className="poke-flash"
            aria-hidden="true"
            initial={{ opacity: motionSet.reduce ? 0 : 0.95 }}
            animate={{ opacity: 0 }}
            transition={motionSet.slow}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Title({ text, size }: { text: string; size: "phone" | "stage" }) {
  return size === "phone" ? (
    <h1 className="phone-prompt poke-title" data-size="phone">
      {text}
    </h1>
  ) : (
    <p className="poke-title" data-size="stage">
      {text}
    </p>
  );
}

function PokePhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const answer = answerOf(view);
  const locked = play.selfAnswer !== null;
  return (
    <section
      className="design-phone poke"
      style={sceneColours}
      aria-label="Your question"
    >
      <QuestionTag play={play}>Trainer quiz</QuestionTag>
      <Title text={play.question.prompt} size="phone" />
      <Mystery view={view} size="phone" />
      <p className="poke-line" aria-live="polite">
        {answer
          ? `It’s ${answer.label}!`
          : locked
            ? "Locked in. Watch the big screen."
            : controls.open
              ? "Pick a name, then send."
              : "Get ready…"}
      </p>
      <div className="poke-menu" role="group" aria-label="Names">
        {view.question.options.map((option, index) => {
          const chosen = view.chosen === option.id;
          const right = view.isAnswer(option.id);
          return (
            <motion.button
              key={option.id}
              type="button"
              className="poke-move motion-press"
              data-chosen={chosen || undefined}
              data-answer={right || undefined}
              aria-pressed={chosen}
              aria-label={right ? `${option.label}, the answer` : option.label}
              disabled={!controls.open}
              onClick={() => controls.onSelect(option.id)}
              initial={{ opacity: 0, y: motionSet.move(14) }}
              animate={{ opacity: view.reveal && !right ? 0.45 : 1, y: 0 }}
              transition={{ ...motionSet.spring, delay: motionSet.delay(index * 0.06) }}
            >
              <span className="poke-cursor" aria-hidden="true">
                ▶
              </span>
              <span className="poke-move-name">{option.label}</span>
            </motion.button>
          );
        })}
      </div>
      <ChoiceSend play={play} controls={controls} label="I choose you!" />
    </section>
  );
}

function PokeStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const answer = answerOf(view);
  return (
    <div className="design-stage poke poke-stage" style={sceneColours}>
      <QuestionTag play={play}>Trainer quiz</QuestionTag>
      <div className="poke-stage-body">
        <Mystery view={view} size="stage" />
        <div className="poke-stage-side">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={answer ? "answer" : "question"}
              initial={{ opacity: 0, y: motionSet.move(20) }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={motionSet.soft}
            >
              <Title
                text={answer ? `It’s ${answer.label}!` : play.question.prompt}
                size="stage"
              />
            </motion.div>
          </AnimatePresence>
          <ul className="poke-menu" data-size="stage" aria-label="Names">
            {view.question.options.map((option, index) => {
              const right = view.isAnswer(option.id);
              return (
                <motion.li
                  key={option.id}
                  className="poke-move"
                  data-answer={right || undefined}
                  initial={{ opacity: 0, x: motionSet.move(40) }}
                  animate={{ opacity: view.reveal && !right ? 0.45 : 1, x: 0 }}
                  transition={{
                    ...motionSet.spring,
                    delay: motionSet.delay(0.15 + index * 0.08),
                  }}
                >
                  <span className="poke-cursor" aria-hidden="true">
                    ▶
                  </span>
                  <span className="poke-move-name">{option.label}</span>
                  <StageVoters play={play} optionId={option.id} />
                </motion.li>
              );
            })}
          </ul>
          {answer ? null : (
            <p className="design-stage-line poke-count">
              <LiveCount
                value={play.submissionCount}
                one="trainer has answered"
                many="trainers have answered"
              />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
