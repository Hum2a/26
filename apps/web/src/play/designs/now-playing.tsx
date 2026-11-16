import { Icon } from "@iconify/react/dist/offline";
import goat from "@iconify-icons/game-icons/goat";
import flute from "@iconify-icons/game-icons/flute";
import drama from "@iconify-icons/lucide/drama";
import micVocal from "@iconify-icons/lucide/mic-vocal";
import music from "@iconify-icons/lucide/music";
import type { IconifyIcon } from "@iconify/types";
import { AnimatePresence, motion } from "motion/react";
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
import "./now-playing.css";

/** Sleeve art for each track. Unknown ids fall back to a note. */
const sleeves: Record<string, IconifyIcon> = {
  "white-girl": micVocal,
  persona: drama,
  flute,
  goat,
};

function sleeve(optionId: string): IconifyIcon {
  return sleeves[optionId] ?? music;
}

function trackNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function NowPlaying(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <NowPlayingPhone {...props} view={view} />
  ) : (
    <NowPlayingStage {...props} view={view} />
  );
}

type View = NonNullable<ReturnType<typeof choiceView>>;

function NowPlayingPhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const revealed = view.reveal !== undefined;
  return (
    <section className="design-phone np" aria-label="Your question">
      <QuestionTag play={play}>Now playing</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <ol className="np-playlist" aria-label="Tracks">
        {view.question.options.map((option, index) => {
          const chosen = view.chosen === option.id;
          const winner = view.isAnswer(option.id);
          return (
            <li key={option.id}>
              <motion.button
                type="button"
                className="np-track motion-press"
                data-chosen={chosen || undefined}
                data-winner={winner || undefined}
                aria-pressed={chosen}
                disabled={!controls.open}
                onClick={() => controls.onSelect(option.id)}
                initial={{ opacity: 0, x: motionSet.move(-16) }}
                animate={{
                  opacity: revealed && !winner ? 0.45 : 1,
                  x: 0,
                  scale: winner ? 1.02 : 1,
                }}
                transition={{
                  ...motionSet.spring,
                  delay: motionSet.delay(index * 0.06),
                }}
              >
                <span className="np-number" aria-hidden="true">
                  {trackNumber(index)}
                </span>
                <span className="np-sleeve" aria-hidden="true">
                  <Icon icon={sleeve(option.id)} />
                </span>
                <span className="np-title">{option.label}</span>
                <span className="np-meter" aria-hidden="true">
                  {[0, 1, 2].map((bar) => (
                    <motion.span
                      key={bar}
                      className="np-bar"
                      animate={{
                        scaleY: chosen || winner ? [0.3, 1, 0.55, 0.85, 0.6] : 0.25,
                      }}
                      transition={{
                        duration: motionSet.reduce ? 0.2 : 0.9,
                        delay: motionSet.delay(bar * 0.08),
                      }}
                    />
                  ))}
                </span>
              </motion.button>
              <AnimatePresence>
                {winner ? (
                  <motion.p
                    className="np-chart"
                    initial={{ opacity: 0, y: motionSet.move(-6) }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={motionSet.soft}
                  >
                    Number one on Humza's chart
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
      <ChoiceSend play={play} controls={controls} label="Play this one" />
    </section>
  );
}

function NowPlayingStage({
  play,
  phase,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const winner = view.question.options.find((option) => view.isAnswer(option.id));
  const spinning = !motionSet.reduce && (phase === "collect" || winner !== undefined);
  return (
    <div className="design-stage np-stage">
      <QuestionTag play={play}>Now playing</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div className="np-deck">
        <div className="np-turntable" aria-hidden="true">
          <motion.div
            className="np-record"
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={
              spinning
                ? { duration: 1.8, ease: "linear", repeat: Infinity }
                : motionSet.soft
            }
          >
            <div className="np-label">
              <AnimatePresence mode="wait">
                <motion.span
                  key={winner?.id ?? "unknown"}
                  className="np-label-icon"
                  initial={{ opacity: 0, rotateY: motionSet.reduce ? 0 : 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: motionSet.reduce ? 0 : -90 }}
                  transition={motionSet.soft}
                >
                  {winner ? <Icon icon={sleeve(winner.id)} /> : "?"}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
          <motion.div
            className="np-arm"
            animate={{ rotate: phase === "collect" || winner ? 24 : 0 }}
            transition={motionSet.slow}
          />
        </div>
        <ol className="np-stage-list">
          {view.question.options.map((option, index) => {
            const isWinner = winner?.id === option.id;
            return (
              <motion.li
                key={option.id}
                className="np-stage-track"
                data-winner={isWinner || undefined}
                initial={{ opacity: 0, x: motionSet.move(40) }}
                animate={{
                  opacity: winner && !isWinner ? 0.35 : 1,
                  x: 0,
                  scale: isWinner ? 1.06 : 1,
                }}
                transition={{
                  ...motionSet.spring,
                  delay: motionSet.delay(0.2 + index * 0.12),
                }}
              >
                <span className="np-number">{trackNumber(index)}</span>
                <span className="np-sleeve">
                  <Icon icon={sleeve(option.id)} />
                </span>
                <span className="np-title">{option.label}</span>
                <StageVoters play={play} optionId={option.id} />
                <span className="np-meter np-meter-live" aria-hidden="true">
                  {[0, 1, 2, 3].map((bar) => (
                    <span
                      key={bar}
                      className="np-bar"
                      style={{ animationDelay: `${bar * 0.17 + index * 0.05}s` }}
                    />
                  ))}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
      <p className="design-stage-line" aria-live="polite">
        {winner ? (
          <>Now playing: {winner.label}.</>
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="track picked"
            many="tracks picked"
          />
        )}
      </p>
    </div>
  );
}
