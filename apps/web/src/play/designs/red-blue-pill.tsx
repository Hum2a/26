import type { CSSProperties } from "react";
import { Icon } from "@iconify/react/dist/offline";
import palm from "@iconify-icons/game-icons/open-palm";
import heartPulse from "@iconify-icons/lucide/heart-pulse";
import { AnimatePresence, motion } from "motion/react";
import { contentColours } from "../../theme/themes";
import type { PresentationProps } from "../presentation";
import {
  ChoiceSend,
  choiceView,
  Count,
  LiveCount,
  QuestionTag,
  StagePrompt,
  useDesignMotion,
} from "./kit";
import "./red-blue-pill.css";

type View = NonNullable<ReturnType<typeof choiceView>>;

/** The colour is the choice, so it stays the same in every theme. */
const sceneColours = {
  "--pill-red": contentColours.pillRed,
  "--pill-red-glow": contentColours.pillRedGlow,
  "--pill-blue": contentColours.pillBlue,
  "--pill-blue-glow": contentColours.pillBlueGlow,
  "--matrix-ink": contentColours.matrixInk,
  "--matrix-code": contentColours.matrixCode,
  "--pill-shine": contentColours.pillShine,
  "--pill-shade": contentColours.pillShade,
} as CSSProperties;

function pillTone(optionId: string, label: string): "red" | "blue" {
  return /blue/i.test(optionId) || /blue/i.test(label) ? "blue" : "red";
}

function verdict(view: View): string {
  const reveal = view.reveal;
  if (!reveal) {
    return "";
  }
  if (reveal.everyone) {
    return "Over half took blue. Everyone lives.";
  }
  const names = view.question.options
    .filter((option) => reveal.winners?.includes(option.id))
    .map((option) => option.label.toLowerCase());
  return names.length > 0
    ? `Blue fell short. Only the ${names.join(" and ")}s live.`
    : "Nobody made it out.";
}

export function RedBluePill(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <PillPhone {...props} view={view} />
  ) : (
    <PillStage {...props} view={view} />
  );
}

function Capsule({
  tone,
  size = "phone",
}: {
  tone: "red" | "blue";
  size?: "phone" | "stage";
}) {
  return (
    <span
      className="pill-capsule"
      data-tone={tone}
      data-size={size}
      aria-hidden="true"
    />
  );
}

function PillPhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const fate = view.reveal && view.sent ? view.scored(view.sent) : undefined;
  return (
    <section
      className="design-phone pill"
      style={sceneColours}
      aria-label="Your question"
    >
      <div className="pill-scene">
        <QuestionTag play={play}>The choice</QuestionTag>
        <h1 className="phone-prompt pill-prompt">{play.question.prompt}</h1>
        <div className="pill-hands">
          {view.question.options.map((option, index) => {
            const tone = pillTone(option.id, option.label);
            const chosen = view.chosen === option.id;
            const other = view.chosen !== undefined && !chosen;
            return (
              <motion.button
                key={option.id}
                type="button"
                className="pill-hand motion-press"
                data-tone={tone}
                data-chosen={chosen || undefined}
                aria-pressed={chosen}
                disabled={!controls.open}
                onClick={() => controls.onSelect(option.id)}
                initial={{ opacity: 0, y: motionSet.move(24) }}
                animate={{ opacity: other ? 0.4 : 1, y: 0, scale: chosen ? 1.05 : 1 }}
                transition={{
                  ...motionSet.spring,
                  delay: motionSet.delay(index * 0.15),
                }}
              >
                <motion.span
                  className="pill-float"
                  animate={{
                    y: chosen ? motionSet.move(-10) : 0,
                    rotate: chosen && !motionSet.reduce ? -18 : -30,
                  }}
                  transition={motionSet.spring}
                >
                  <Capsule tone={tone} />
                </motion.span>
                <Icon icon={palm} className="pill-palm" aria-hidden="true" />
                <span className="pill-label">{option.label}</span>
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence>
          {view.reveal ? (
            <motion.div
              className="pill-verdict"
              initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ ...motionSet.soft, delay: motionSet.delay(0.3) }}
            >
              <p>{verdict(view)}</p>
              {fate !== undefined ? (
                <p className="pill-fate" data-alive={fate || undefined}>
                  {fate ? (
                    "You live."
                  ) : (
                    <>
                      <Icon icon={heartPulse} aria-hidden="true" /> You did not make it.
                    </>
                  )}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <ChoiceSend play={play} controls={controls} label="Swallow it" />
    </section>
  );
}

const rainColumns = Array.from({ length: 18 }, (_, column) => column);
const glyphs = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789";

function rainText(seed: number): string {
  let text = "";
  for (let index = 0; index < 22; index += 1) {
    text += glyphs[(seed * 7 + index * 13) % glyphs.length];
  }
  return text;
}

function PillStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const blue = view.question.options.find(
    (option) => pillTone(option.id, option.label) === "blue",
  );
  const blueVotes = blue ? view.count(blue.id) : 0;
  const blueShare = view.total > 0 ? blueVotes / view.total : 0;
  const redVotes = view.total - blueVotes;
  return (
    <div className="design-stage pill-stage" style={sceneColours}>
      <div className="pill-rain" aria-hidden="true">
        {rainColumns.map((column) => (
          <span
            key={column}
            className="pill-rain-column"
            style={{
              left: `${(column / rainColumns.length) * 100}%`,
              animationDuration: `${6 + (column % 5) * 1.3}s`,
              animationDelay: `${-(column % 7) * 0.9}s`,
            }}
          >
            {rainText(column)}
          </span>
        ))}
      </div>
      <div className="pill-stage-body">
        <QuestionTag play={play}>The choice</QuestionTag>
        <StagePrompt text={play.question.prompt} className="pill-stage-prompt" />
        <div className="pill-stage-hands">
          {view.question.options.map((option, index) => {
            const tone = pillTone(option.id, option.label);
            const lost = view.reveal !== undefined && !view.scored(option.id);
            return (
              <motion.div
                key={option.id}
                className="pill-stage-hand"
                data-tone={tone}
                data-lost={lost || undefined}
                initial={{ opacity: 0, x: motionSet.move(index === 0 ? -80 : 80) }}
                animate={{ opacity: lost ? 0.35 : 1, x: 0 }}
                transition={{
                  ...motionSet.slow,
                  delay: motionSet.delay(lost ? 2.4 : 0.2),
                }}
              >
                <motion.span
                  className="pill-float"
                  animate={motionSet.reduce ? { y: 0 } : { y: [0, -18, 0] }}
                  transition={
                    motionSet.reduce
                      ? motionSet.soft
                      : {
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 1.5,
                        }
                  }
                >
                  <Capsule tone={tone} size="stage" />
                </motion.span>
                <Icon icon={palm} className="pill-palm" />
                <span className="pill-label">
                  {option.label}
                  {view.reveal ? (
                    <>
                      {" · "}
                      <Count value={view.count(option.id)} />
                    </>
                  ) : null}
                </span>
                {lost ? <Icon icon={heartPulse} className="pill-flatline" /> : null}
              </motion.div>
            );
          })}
        </div>
        {view.reveal ? (
          <div
            className="pill-split"
            aria-label={`${Math.round(blueShare * 100)}% took blue`}
          >
            <motion.span
              className="pill-split-red"
              initial={{ flexGrow: 1 }}
              animate={{ flexGrow: Math.max(0.0001, 1 - blueShare) }}
              transition={{
                duration: motionSet.reduce ? 0.2 : 1.8,
                ease: [0.2, 0, 0, 1],
                delay: motionSet.delay(0.4),
              }}
            >
              {redVotes > 0 ? `${Math.round((1 - blueShare) * 100)}%` : ""}
            </motion.span>
            <motion.span
              className="pill-split-blue"
              initial={{ flexGrow: 1 }}
              animate={{ flexGrow: Math.max(0.0001, blueShare) }}
              transition={{
                duration: motionSet.reduce ? 0.2 : 1.8,
                ease: [0.2, 0, 0, 1],
                delay: motionSet.delay(0.4),
              }}
            >
              {blueVotes > 0 ? `${Math.round(blueShare * 100)}%` : ""}
            </motion.span>
            <span className="pill-split-mark" aria-hidden="true">
              50%
            </span>
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          {view.reveal ? (
            <motion.p
              key="verdict"
              className="pill-stage-verdict"
              initial={{ opacity: 0, y: motionSet.move(20) }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionSet.soft, delay: motionSet.delay(2.2) }}
            >
              {verdict(view)}
            </motion.p>
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
                one="pill swallowed"
                many="pills swallowed"
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
