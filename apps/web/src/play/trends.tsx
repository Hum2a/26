import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon, type IconifyIcon } from "@iconify/react/dist/offline";
import alarmClock from "@iconify-icons/lucide/alarm-clock";
import brain from "@iconify-icons/lucide/brain";
import camera from "@iconify-icons/lucide/camera";
import chartColumn from "@iconify-icons/lucide/chart-column";
import compass from "@iconify-icons/lucide/compass";
import cpu from "@iconify-icons/lucide/cpu";
import crown from "@iconify-icons/lucide/crown";
import dices from "@iconify-icons/lucide/dices";
import feather from "@iconify-icons/lucide/feather";
import flag from "@iconify-icons/lucide/flag";
import flame from "@iconify-icons/lucide/flame";
import footprints from "@iconify-icons/lucide/footprints";
import ghost from "@iconify-icons/lucide/ghost";
import globe from "@iconify-icons/lucide/globe";
import hourglass from "@iconify-icons/lucide/hourglass";
import languages from "@iconify-icons/lucide/languages";
import laptop from "@iconify-icons/lucide/laptop";
import leaf from "@iconify-icons/lucide/leaf";
import moon from "@iconify-icons/lucide/moon";
import plug from "@iconify-icons/lucide/plug";
import rotateCw from "@iconify-icons/lucide/rotate-cw";
import ruler from "@iconify-icons/lucide/ruler";
import shield from "@iconify-icons/lucide/shield";
import skull from "@iconify-icons/lucide/skull";
import smile from "@iconify-icons/lucide/smile";
import sparkles from "@iconify-icons/lucide/sparkles";
import split from "@iconify-icons/lucide/split";
import sun from "@iconify-icons/lucide/sun";
import tablet from "@iconify-icons/lucide/tablet";
import target from "@iconify-icons/lucide/target";
import trophy from "@iconify-icons/lucide/trophy";
import letters from "@iconify-icons/lucide/type";
import users from "@iconify-icons/lucide/users";
import wifi from "@iconify-icons/lucide/wifi";
import zap from "@iconify-icons/lucide/zap";
import clock from "@iconify-icons/lucide/clock";
import apple from "@iconify-icons/simple-icons/apple";
import android from "@iconify-icons/simple-icons/android";
import type { QuestionTrends, SelfTrends, TrendCard, TrendIcon } from "@26/shared";
import "./trends.css";

const icons: Record<TrendIcon, IconifyIcon> = {
  apple,
  android,
  laptop,
  tablet,
  compass,
  globe,
  moon,
  sun,
  ruler,
  sparkles,
  languages,
  clock,
  wifi,
  plug,
  cpu,
  feather,
  rotate: rotateCw,
  leaf,
  zap,
  hourglass,
  alarm: alarmClock,
  crown,
  footprints,
  skull,
  shield,
  camera,
  smile,
  flame,
  type: letters,
  users,
  split,
  target,
  trophy,
  ghost,
  brain,
  chart: chartColumn,
  flag,
  dice: dices,
};

/** How long each card stays on the projector before the next one. */
export const trendRotateMs = 7_000;

export function TrendGlyph({ icon }: { icon: TrendIcon }) {
  return <Icon icon={icons[icon]} aria-hidden="true" className="trend-glyph" />;
}

/**
 * The projector's answer trends: one card at a time, rotating, with the
 * figure and bars animating in. Reduced motion keeps a short fade only.
 */
export function StageTrends({ trends }: { trends: QuestionTrends }) {
  const reduce = useReducedMotion() ?? false;
  const count = trends.cards.length;
  const questionId = trends.questionId;
  // The rotation belongs to one question: a new question starts at its first card.
  const [rotation, setRotation] = useState({ questionId, index: 0 });
  const index =
    rotation.questionId === questionId ? rotation.index % Math.max(1, count) : 0;
  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(
      () =>
        setRotation((current) => ({
          questionId,
          index: current.questionId === questionId ? (current.index + 1) % count : 1,
        })),
      trendRotateMs,
    );
    return () => window.clearInterval(timer);
  }, [questionId, count]);
  const card = trends.cards[index];
  if (!card) return null;
  return (
    <motion.aside
      className="projector-trends skin-panel"
      aria-label="How the room answered"
      initial={{ opacity: 0, x: reduce ? 0 : 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { type: "spring", stiffness: 260, damping: 28, delay: 0.9 }
      }
    >
      <header className="trends-header">
        <p className="trends-eyebrow">How the room answered</p>
        <p className="trends-count">
          {trends.responses} {trends.responses === 1 ? "answer" : "answers"}
        </p>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: reduce ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -12 }}
          transition={
            reduce ? { duration: 0.18 } : { duration: 0.35, ease: [0.2, 0, 0, 1] }
          }
        >
          <TrendCardView card={card} size="stage" reduce={reduce} />
        </motion.div>
      </AnimatePresence>
      {count > 1 ? (
        <ol className="trends-dots" aria-label={`Card ${index + 1} of ${count}`}>
          {trends.cards.map((item, position) => (
            <li
              key={item.id}
              data-active={position === index || undefined}
              aria-hidden="true"
            />
          ))}
        </ol>
      ) : null}
    </motion.aside>
  );
}

/** One trend card. The admin page reuses it to preview every candidate. */
export function TrendCardView({
  card,
  size,
  reduce = false,
}: {
  card: TrendCard;
  size: "stage" | "compact";
  reduce?: boolean;
}) {
  return (
    <article className="trend-card" data-size={size} data-tone={card.tone}>
      <div className="trend-card-top">
        <span className="trend-icon" data-tone={card.tone}>
          <TrendGlyph icon={card.icon} />
        </span>
        {card.figure ? (
          <p className="trend-figure">
            <strong>{card.figure.value}</strong>
            <span>{card.figure.caption}</span>
          </p>
        ) : null}
      </div>
      <h3 className="trend-headline">{card.headline}</h3>
      <p className="trend-detail">{card.detail}</p>
      {card.bars.length > 0 ? (
        <ul className="trend-bars" aria-label="Comparison">
          {card.bars.map((bar, position) => (
            <li
              key={`${bar.label}:${position}`}
              data-highlight={bar.highlight || undefined}
            >
              <span className="trend-bar-label">{bar.label}</span>
              <span className="trend-bar-track" aria-hidden="true">
                <motion.span
                  className="trend-bar-fill"
                  initial={{ scaleX: reduce ? bar.value / 100 : 0 }}
                  animate={{ scaleX: bar.value / 100 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          duration: 0.7,
                          delay: 0.15 + position * 0.12,
                          ease: [0.2, 0, 0, 1],
                        }
                  }
                />
              </span>
              <span className="trend-bar-value">{bar.display}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** A guest's phone after the reveal: how their answer compared with the room. */
export function PhoneTrends({ trends }: { trends: SelfTrends }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.section
      className="phone-trends skin-panel"
      aria-label="You and the room"
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0.2 } : { duration: 0.4, delay: 0.5, ease: [0.2, 0, 0, 1] }
      }
    >
      <h2 className="phone-trends-title">You and the room</h2>
      <ul className="phone-trends-lines">
        {trends.lines.map((line, position) => (
          <motion.li
            key={`${trends.questionId}:${position}`}
            initial={{ opacity: 0, x: reduce ? 0 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : { duration: 0.3, delay: 0.65 + position * 0.12, ease: [0.2, 0, 0, 1] }
            }
          >
            <span className="phone-trends-icon">
              <TrendGlyph icon={line.icon} />
            </span>
            <span>{line.text}</span>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}
