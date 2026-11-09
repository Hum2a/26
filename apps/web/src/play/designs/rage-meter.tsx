import { useState, type CSSProperties } from "react";
import { Icon } from "@iconify/react/dist/offline";
import alien from "@iconify-icons/game-icons/alien-stare";
import flame from "@iconify-icons/lucide/flame";
import landmark from "@iconify-icons/lucide/landmark";
import palm from "@iconify-icons/lucide/tree-palm";
import snowflake from "@iconify-icons/lucide/snowflake";
import undo from "@iconify-icons/lucide/undo-2";
import zap from "@iconify-icons/lucide/zap";
import apple from "@iconify-icons/simple-icons/apple";
import type { IconifyIcon } from "@iconify/types";
import { LayoutGroup, motion } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import { assignTier, type TierPlacement } from "../controls/TierAssign";
import type { PhoneControls, PresentationProps } from "../presentation";
import { LiveCount, QuestionTag, StagePrompt, useDesignMotion } from "./kit";
import "./rage-meter.css";

type RankQuestion = Extract<PlaySnapshot["question"], { kind: "rank" }>;
type RankReveal = Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "rank" }>;

const triggerIcons: Record<string, IconifyIcon> = {
  apple,
  "palm-beach-pete": palm,
  politics: landmark,
  conspiracy: alien,
};

function triggerIcon(itemId: string): IconifyIcon {
  return triggerIcons[itemId] ?? zap;
}

/** Heat from the first tier (hottest) to the last (coolest), as a share of the accent. */
function heat(index: number, count: number): number {
  return Math.round(90 - (index / Math.max(1, count - 1)) * 75);
}

export function RageMeter(props: PresentationProps) {
  const question = props.play.question;
  if (question.kind !== "rank") {
    return undefined;
  }
  const reveal = props.play.reveal?.kind === "rank" ? props.play.reveal : undefined;
  return props.surface === "phone" ? (
    <RagePhone
      key={`${question.id}-${props.play.selfAnswer ? "sent" : "open"}`}
      play={props.play}
      controls={props.controls}
      question={question}
      reveal={reveal}
    />
  ) : (
    <RageStage play={props.play} question={question} reveal={reveal} />
  );
}

function RagePhone({
  play,
  controls,
  question,
  reveal,
}: {
  play: PlaySnapshot;
  controls: PhoneControls;
  question: RankQuestion;
  reveal: RankReveal | undefined;
}) {
  const motionSet = useDesignMotion();
  const accepted =
    play.selfAnswer?.kind === "rank" ? play.selfAnswer.placements : undefined;
  const [history, setHistory] = useState<TierPlacement[][]>([accepted ?? []]);
  const [picked, setPicked] = useState<string>();
  const placements = history[history.length - 1] ?? [];
  const locked = accepted !== undefined;
  const editable = controls.open && !locked;
  const ready = question.items.every((item) =>
    placements.some((placement) => placement.itemId === item.id),
  );

  function place(tierId: string) {
    if (!picked || !editable) {
      return;
    }
    setHistory((current) => [
      ...current,
      assignTier(placements, picked, tierId, question.ties),
    ]);
    setPicked(undefined);
  }

  const tray = question.items.filter(
    (item) => !placements.some((placement) => placement.itemId === item.id),
  );
  const truthFor = (tierId: string) =>
    reveal?.order.find((group) => group.tierId === tierId)?.itemIds ?? [];

  return (
    <section className="design-phone rage" aria-label="Your question">
      <QuestionTag play={play}>Rage meter</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      {editable ? (
        <p className="rage-help">
          {picked
            ? "Now tap how fast it gets him."
            : "Tap a trigger, then tap its heat."}
        </p>
      ) : null}
      <LayoutGroup>
        <ol className="rage-tube" aria-label="Heat levels, fastest first">
          {question.tiers.map((tier, index) => {
            const placed = placements.find((placement) => placement.tierId === tier.id);
            const item = question.items.find((entry) => entry.id === placed?.itemId);
            const truth = truthFor(tier.id);
            const right = reveal && item ? truth.includes(item.id) : undefined;
            // At the reveal each slot shows the true trigger. Chips glide there from the guest's guess.
            const shown = reveal
              ? question.items.find((entry) => truth.includes(entry.id))
              : item;
            return (
              <li key={tier.id}>
                <button
                  type="button"
                  className="rage-slot motion-press"
                  style={
                    {
                      "--heat": `${heat(index, question.tiers.length)}%`,
                    } as CSSProperties
                  }
                  data-armed={(picked && editable) || undefined}
                  disabled={!editable || !picked}
                  onClick={() => place(tier.id)}
                  aria-label={`${tier.label}${shown ? `: ${shown.label}` : ", empty"}`}
                >
                  <span className="rage-level" aria-hidden="true">
                    <Icon
                      icon={
                        index === 0
                          ? flame
                          : index === question.tiers.length - 1
                            ? snowflake
                            : zap
                      }
                    />
                    {tier.label}
                  </span>
                  {shown ? (
                    <motion.span
                      layoutId={`rage-${shown.id}`}
                      className="rage-chip"
                      data-placed
                      transition={motionSet.spring}
                    >
                      <Icon icon={triggerIcon(shown.id)} aria-hidden="true" />
                      {shown.label}
                    </motion.span>
                  ) : (
                    <span className="rage-empty">Empty</span>
                  )}
                  {right !== undefined ? (
                    <motion.span
                      className="rage-verdict"
                      data-right={right || undefined}
                      initial={{ opacity: 0, scale: motionSet.reduce ? 1 : 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        ...motionSet.spring,
                        delay: motionSet.delay(0.15 * index),
                      }}
                    >
                      {right ? "✓" : "✗"}
                    </motion.span>
                  ) : null}
                </button>
                {reveal && right === false && item ? (
                  <p className="rage-truth">You said {item.label}.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
        {tray.length > 0 && !reveal ? (
          <div className="rage-tray" aria-label="Triggers to place">
            {tray.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                layoutId={`rage-${item.id}`}
                className="rage-chip motion-press"
                data-picked={picked === item.id || undefined}
                aria-pressed={picked === item.id}
                disabled={!editable}
                onClick={() =>
                  setPicked((current) => (current === item.id ? undefined : item.id))
                }
                transition={motionSet.spring}
              >
                <Icon icon={triggerIcon(item.id)} aria-hidden="true" />
                {item.label}
              </motion.button>
            ))}
          </div>
        ) : null}
      </LayoutGroup>
      {editable && history.length > 1 ? (
        <button
          type="button"
          className="rage-undo motion-press"
          onClick={() => setHistory((current) => current.slice(0, -1))}
        >
          <Icon icon={undo} aria-hidden="true" /> Undo
        </button>
      ) : null}
      {controls.open || controls.pending || locked ? (
        <SubmitButton
          className={controls.dodge ? "troll-dodge" : ""}
          label="Send ranking"
          state={roundSubmitState(locked, controls.pending)}
          disabled={!locked && !ready}
          onClick={() => controls.onRank(placements)}
        />
      ) : null}
    </section>
  );
}

function RageStage({
  play,
  question,
  reveal,
}: {
  play: PlaySnapshot;
  question: RankQuestion;
  reveal: RankReveal | undefined;
}) {
  const motionSet = useDesignMotion();
  const coolestFirst = [...question.tiers].reverse();
  const last = question.tiers.length - 1;
  return (
    <div className="design-stage rage-stage">
      <QuestionTag play={play}>Rage meter</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div className="rage-gauge">
        <motion.div
          className="rage-mercury"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: reveal ? 1 : 0.12 }}
          transition={{
            duration: motionSet.reduce ? 0.2 : 3.2,
            ease: [0.4, 0, 0.2, 1],
            delay: motionSet.delay(0.3),
          }}
        />
        {coolestFirst.map((tier, step) => {
          const tierIndex = last - step;
          const itemIds =
            reveal?.order.find((group) => group.tierId === tier.id)?.itemIds ?? [];
          const hottest = tierIndex === 0;
          return (
            <div
              key={tier.id}
              className="rage-column"
              style={
                {
                  "--heat": `${heat(tierIndex, question.tiers.length)}%`,
                } as CSSProperties
              }
            >
              <span className="rage-column-label">
                <Icon
                  icon={hottest ? flame : tierIndex === last ? snowflake : zap}
                  aria-hidden="true"
                />
                {tier.label}
              </span>
              <div className="rage-column-well">
                {itemIds.map((itemId) => {
                  const item = question.items.find((entry) => entry.id === itemId);
                  return (
                    <motion.div
                      key={itemId}
                      className="rage-stage-chip"
                      data-hottest={hottest || undefined}
                      initial={{
                        opacity: 0,
                        y: motionSet.move(-160),
                        scale: motionSet.reduce ? 1 : 0.6,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        rotate: hottest && !motionSet.reduce ? [0, -3, 3, -2, 2, 0] : 0,
                      }}
                      transition={{
                        ...motionSet.spring,
                        delay: motionSet.delay(0.6 + step * 0.8),
                        rotate: {
                          duration: 0.6,
                          delay: motionSet.delay(0.9 + step * 0.8),
                        },
                      }}
                    >
                      <Icon icon={triggerIcon(itemId)} aria-hidden="true" />
                      {item?.label ?? itemId}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {reveal ? null : (
        <div className="rage-floaters" aria-label="Triggers">
          {question.items.map((item, index) => (
            <motion.span
              key={item.id}
              className="rage-stage-chip"
              animate={motionSet.reduce ? { opacity: 1 } : { y: [0, -14, 0] }}
              transition={
                motionSet.reduce
                  ? motionSet.soft
                  : {
                      duration: 2.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.4,
                    }
              }
            >
              <Icon icon={triggerIcon(item.id)} aria-hidden="true" />
              {item.label}
            </motion.span>
          ))}
        </div>
      )}
      <p className="design-stage-line">
        {reveal ? (
          <>
            Hottest:{" "}
            {
              question.items.find((item) => reveal.order[0]?.itemIds.includes(item.id))
                ?.label
            }
            .
          </>
        ) : (
          <LiveCount value={play.submissionCount} one="ranking in" many="rankings in" />
        )}
      </p>
    </div>
  );
}
