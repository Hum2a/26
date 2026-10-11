import { Icon } from "@iconify/react/dist/offline";
import lever from "@iconify-icons/game-icons/lever";
import hand from "@iconify-icons/lucide/hand";
import { motion } from "motion/react";
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
import "./trolley-lever.css";

type View = NonNullable<ReturnType<typeof choiceView>>;
type Branch = "five" | "one";

/** Pulling the lever sends the tram to the branch with one person. */
function branchFor(view: View, optionId: string): Branch {
  if (optionId === "derail") {
    return "one";
  }
  if (optionId === "leave") {
    return "five";
  }
  return view.question.options[0]?.id === optionId ? "one" : "five";
}

const tracks: Record<Branch, string> = {
  five: "M380 190 C 480 190, 540 92, 800 92",
  one: "M380 190 C 480 190, 540 288, 800 288",
};

const fivePeople = [600, 640, 680, 720, 760];

function Person({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="trolley-person" transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="0" cy="-30" r="8" />
      <path d="M0 -22 L0 0 M-10 -14 L10 -14 M0 0 L-8 14 M0 0 L8 14" />
    </g>
  );
}

function Scene({
  points,
  lit,
  tramX,
  idle,
  labels,
}: {
  points: Branch | undefined;
  lit: Branch | undefined;
  tramX: number;
  idle: boolean;
  labels?: Record<Branch, string>;
}) {
  const motionSet = useDesignMotion();
  const angle = points === "five" ? -14 : points === "one" ? 14 : 0;
  return (
    <svg
      className="trolley-scene"
      viewBox="0 0 800 380"
      role="img"
      aria-label="A tram heading for a junction. Five people on one branch, one on the other."
    >
      <path className="trolley-sleepers" d="M0 190 L380 190" />
      {(["five", "one"] as const).map((branch) => (
        <g key={branch}>
          <path className="trolley-sleepers" d={tracks[branch]} />
          <motion.path
            className="trolley-rail"
            d={tracks[branch]}
            animate={{ opacity: lit && lit !== branch ? 0.35 : 1 }}
            data-lit={lit === branch || undefined}
            transition={motionSet.soft}
          />
        </g>
      ))}
      <path className="trolley-rail" d="M0 190 L380 190" />
      <motion.line
        className="trolley-points"
        x1="380"
        y1="190"
        x2="440"
        y2="190"
        style={{ transformBox: "view-box", transformOrigin: "380px 190px" }}
        animate={{ rotate: angle }}
        transition={motionSet.spring}
      />
      {fivePeople.map((x) => (
        <Person key={x} x={x} y={80} />
      ))}
      <Person x={700} y={276} />
      {labels ? (
        <>
          <text className="trolley-label" x="790" y="40" textAnchor="end">
            {labels.five}
          </text>
          <text className="trolley-label" x="790" y="362" textAnchor="end">
            {labels.one}
          </text>
        </>
      ) : null}
      <motion.g
        className="trolley-tram"
        initial={{ x: 0 }}
        animate={{ x: tramX, y: idle && !motionSet.reduce ? [0, -3, 0] : 0 }}
        transition={{
          x: {
            duration: motionSet.reduce ? 0.2 : 2.4,
            ease: [0.4, 0, 0.2, 1],
            delay: motionSet.delay(1),
          },
          y:
            idle && !motionSet.reduce
              ? { duration: 0.6, repeat: Infinity }
              : motionSet.soft,
        }}
      >
        <rect x="20" y="138" width="130" height="44" rx="12" className="trolley-body" />
        <rect x="34" y="148" width="28" height="18" rx="4" className="trolley-window" />
        <rect x="70" y="148" width="28" height="18" rx="4" className="trolley-window" />
        <rect
          x="106"
          y="148"
          width="28"
          height="18"
          rx="4"
          className="trolley-window"
        />
        <circle cx="50" cy="186" r="9" className="trolley-wheel" />
        <circle cx="120" cy="186" r="9" className="trolley-wheel" />
      </motion.g>
    </svg>
  );
}

export function TrolleyLever(props: PresentationProps) {
  const view = choiceView(
    props.play,
    props.surface === "phone" ? props.controls.selectedId : undefined,
  );
  if (!view) {
    return undefined;
  }
  return props.surface === "phone" ? (
    <TrolleyPhone {...props} view={view} />
  ) : (
    <TrolleyStage {...props} view={view} />
  );
}

function TrolleyPhone({
  play,
  controls,
  view,
}: Extract<PresentationProps, { surface: "phone" }> & { view: View }) {
  const motionSet = useDesignMotion();
  const branch = view.chosen ? branchFor(view, view.chosen) : undefined;
  return (
    <section className="design-phone trolley" aria-label="Your question">
      <QuestionTag play={play}>The lever</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <Scene points={branch} lit={branch} tramX={0} idle={false} />
      <div className="trolley-controls">
        {view.question.options.map((option, index) => {
          const chosen = view.chosen === option.id;
          const pull = branchFor(view, option.id) === "one";
          return (
            <motion.button
              key={option.id}
              type="button"
              className="trolley-choice motion-press"
              data-chosen={chosen || undefined}
              aria-pressed={chosen}
              disabled={!controls.open}
              onClick={() => controls.onSelect(option.id)}
              initial={{ opacity: 0, y: motionSet.move(12) }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionSet.spring, delay: motionSet.delay(index * 0.1) }}
            >
              <motion.span
                className="trolley-choice-icon"
                aria-hidden="true"
                animate={{ rotate: chosen && pull && !motionSet.reduce ? -35 : 0 }}
                transition={motionSet.spring}
              >
                <Icon icon={pull ? lever : hand} />
              </motion.span>
              <span>{option.label}</span>
              {view.reveal ? (
                <span className="trolley-choice-count">
                  <Count value={view.count(option.id)} />
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>
      <ChoiceSend play={play} controls={controls} label="Commit to it" />
    </section>
  );
}

function TrolleyStage({
  play,
  view,
}: Extract<PresentationProps, { surface: "stage" }> & { view: View }) {
  const totals: Record<Branch, number> = { five: 0, one: 0 };
  for (const option of view.question.options) {
    totals[branchFor(view, option.id)] += view.count(option.id);
  }
  const majority: Branch | undefined = view.reveal
    ? totals.one > totals.five
      ? "one"
      : totals.five > totals.one
        ? "five"
        : undefined
    : undefined;
  const percent = (votes: number) =>
    view.total > 0 ? `${Math.round((votes / view.total) * 100)}%` : "0%";
  const labels = view.reveal
    ? {
        five: `${totals.five} left it · ${percent(totals.five)}`,
        one: `${totals.one} pulled the lever · ${percent(totals.one)}`,
      }
    : undefined;
  return (
    <div className="design-stage trolley-stage">
      <QuestionTag play={play}>The lever</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <Scene
        points={majority}
        lit={majority}
        tramX={view.reveal ? 210 : 0}
        idle={!view.reveal}
        labels={labels}
      />
      <p className="design-stage-line">
        {view.reveal ? (
          majority === "one" ? (
            "The room pulled the lever."
          ) : majority === "five" ? (
            "The room left the lever alone."
          ) : (
            "The room is split down the middle."
          )
        ) : (
          <LiveCount
            value={play.submissionCount}
            one="hand on the lever"
            many="hands on the lever"
          />
        )}
      </p>
    </div>
  );
}
