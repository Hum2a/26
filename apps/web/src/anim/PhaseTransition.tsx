import { type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
import type { PhaseMotion } from "../theme/identity";
import { useThemeIdentity } from "../theme/use-theme-identity";

type PhaseStyle = {
  initial: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
  /** Where a shape that cannot morph into the default resting shape settles. */
  settle?: TargetAndTransition;
};

const eased = { duration: 0.28, ease: [0.2, 0, 0, 1] } as const;

/**
 * How each theme hands one phone phase to the next. Every style settles on the
 * same resting state, so the question is always fully readable once it lands.
 */
const phoneStyles: Record<PhaseMotion, PhaseStyle> = {
  rise: {
    initial: { opacity: 0, y: 12 },
    exit: { opacity: 0, y: -8 },
    transition: eased,
  },
  fade: { initial: { opacity: 0 }, exit: { opacity: 0 }, transition: eased },
  slide: {
    initial: { opacity: 0, x: 36 },
    exit: { opacity: 0, x: -28 },
    transition: { duration: 0.3, ease: [0.2, 0.9, 0.1, 1] },
  },
  wipe: {
    initial: { clipPath: "inset(0 100% 0 0)" },
    exit: { clipPath: "inset(0 0 0 100%)" },
    transition: { duration: 0.34, ease: [0.7, 0, 0.2, 1] },
  },
  iris: {
    initial: { clipPath: "circle(0% at 50% 40%)" },
    settle: { clipPath: "circle(150% at 50% 40%)" },
    exit: { opacity: 0 },
    transition: { duration: 0.42, ease: [0.7, 0, 0.2, 1] },
  },
  zoom: {
    initial: { opacity: 0, scale: 0.9 },
    exit: { opacity: 0, scale: 1.05 },
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
  flip: {
    initial: { opacity: 0, rotateX: -60, transformPerspective: 900 },
    exit: { opacity: 0, rotateX: 50, transformPerspective: 900 },
    transition: { duration: 0.36, ease: [0.2, 0, 0, 1] },
  },
  glitch: {
    initial: { opacity: 0, x: 8 },
    exit: { opacity: 0, x: -6 },
    transition: { duration: 0.24, ease: "linear" },
  },
  drop: {
    initial: { opacity: 0, y: -36 },
    exit: { opacity: 0, y: 24 },
    transition: { type: "spring", stiffness: 420, damping: 22 },
  },
  skew: {
    initial: { opacity: 0, x: 48, skewX: -10 },
    exit: { opacity: 0, x: -40, skewX: 10 },
    transition: { duration: 0.26, ease: [0.2, 0.9, 0.1, 1] },
  },
  blur: {
    initial: { opacity: 0, filter: "blur(10px)" },
    exit: { opacity: 0, filter: "blur(8px)" },
    transition: { duration: 0.42, ease: [0.45, 0, 0.2, 1] },
  },
  shutter: {
    initial: { clipPath: "inset(50% 0 50% 0)" },
    exit: { clipPath: "inset(50% 0 50% 0)" },
    transition: { duration: 0.32, ease: [0.7, 0, 0.2, 1] },
  },
};

/**
 * The projector keeps the question legible from the first frame: it never
 * fades from nothing or clips its text. Each theme only nudges the arrival.
 */
const stageStyles: Record<PhaseMotion, TargetAndTransition> = {
  rise: { y: 6 },
  fade: {},
  slide: { x: 16 },
  wipe: { x: -16 },
  iris: { scale: 0.985 },
  zoom: { scale: 0.97 },
  flip: { rotateX: -6, transformPerspective: 1200 },
  glitch: { x: 4 },
  drop: { y: -10 },
  skew: { x: 10, skewX: -3 },
  blur: { filter: "blur(3px)" },
  shutter: { scaleY: 0.985 },
};

const resting: TargetAndTransition = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  scaleY: 1,
  rotateX: 0,
  skewX: 0,
  filter: "blur(0px)",
  clipPath: "inset(0% 0% 0% 0%)",
};

export function PhaseTransition({
  phase,
  scene,
  children,
  stage = false,
}: {
  phase: string;
  /** Phases sharing a scene keep one mounted subtree, such as a live race renderer. */
  scene?: string;
  children: ReactNode;
  stage?: boolean;
}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { transition } = useThemeIdentity();
  const identity = scene ?? phase;
  // Projected state must change with the server snapshot. Keeping an outgoing
  // question mounted until an exit completes can show the wrong phase heading.
  if (stage) {
    const nudge = stageStyles[transition];
    return (
      <motion.div
        key={identity}
        data-phase={phase}
        data-phase-motion={reduce ? "fade" : "eased"}
        data-transition={transition}
        initial={{ opacity: 0.96, ...(reduce ? {} : nudge) }}
        animate={
          reduce
            ? { opacity: 1 }
            : { opacity: 1, ...pick(resting, Object.keys(nudge)), y: 0 }
        }
        transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <AnimatePresence mode="wait">
      <PhonePhase key={identity} phase={phase} reduce={reduce} style={transition}>
        {children}
      </PhonePhase>
    </AnimatePresence>
  );
}

function PhonePhase({
  phase,
  reduce,
  style,
  children,
}: {
  phase: string;
  reduce: boolean;
  style: PhaseMotion;
  children: ReactNode;
}) {
  const present = useIsPresent();
  const motionStyle = phoneStyles[style];
  return (
    <motion.fieldset
      disabled={!present}
      aria-hidden={!present || undefined}
      className="m-0 min-w-0 border-0 p-0"
      data-phase={phase}
      data-phase-motion={reduce ? "fade" : "eased"}
      data-transition={style}
      initial={reduce ? { opacity: 0.96, y: 0 } : motionStyle.initial}
      animate={
        reduce
          ? { opacity: 1, y: 0 }
          : {
              ...pick(resting, Object.keys(motionStyle.initial)),
              ...motionStyle.settle,
              opacity: 1,
            }
      }
      exit={reduce ? { opacity: 0.96, y: 0 } : motionStyle.exit}
      transition={
        reduce ? { duration: 0.12, ease: [0.2, 0, 0, 1] } : motionStyle.transition
      }
    >
      {children}
    </motion.fieldset>
  );
}

/** The resting values for only the properties a style animates. */
function pick(source: TargetAndTransition, keys: string[]): TargetAndTransition {
  const values = source as Record<string, unknown>;
  return Object.fromEntries(
    keys.filter((key) => key in values).map((key) => [key, values[key]]),
  ) as TargetAndTransition;
}
