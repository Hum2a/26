import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { motion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import undo from "@iconify-icons/lucide/undo-2";
import chevronLeft from "@iconify-icons/lucide/chevron-left";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import type { TierPlacement } from "../controls/TierAssign";
import type { PhoneControls, PresentationProps } from "../presentation";
import { preloadImages } from "../preload";
import { LiveCount, QuestionTag, StagePrompt, useDesignMotion } from "./kit";
import {
  assignQuote,
  countForTier,
  nextUnassigned,
  swipeDecision,
  unassignQuote,
} from "./ed-or-humza-assign";
import {
  edOrHumzaPhotos,
  edOrHumzaPreloadPaths,
  isEdOrHumzaPerson,
} from "./ed-or-humza-photos";
import "./ed-or-humza.css";

type RankQuestion = Extract<PlaySnapshot["question"], { kind: "rank" }>;
type RankReveal = Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "rank" }>;

/** One quote at a time, swipe or tap into Ed or Humza, then send the whole list. */
export function EdOrHumza(props: PresentationProps) {
  const question = props.play.question;
  if (question.kind !== "rank" || question.input !== "buckets") {
    return undefined;
  }
  const reveal = props.play.reveal?.kind === "rank" ? props.play.reveal : undefined;
  return props.surface === "phone" ? (
    <SortPhone
      key={`${question.id}-${props.play.selfAnswer ? "sent" : "open"}`}
      play={props.play}
      controls={props.controls}
      question={question}
      reveal={reveal}
    />
  ) : (
    <SortStage play={props.play} question={question} reveal={reveal} />
  );
}

function SortPhone({
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
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState<string>();
  const placements = history[history.length - 1] ?? [];
  const locked = accepted !== undefined;
  const editable = controls.open && !locked;
  const current = nextUnassigned(question.items, placements);
  const ready = question.items.every((item) =>
    placements.some((placement) => placement.itemId === item.id),
  );
  const left = question.tiers[0];
  const right = question.tiers[1];
  const leftId = left?.id;
  const rightId = right?.id;
  const currentId = current?.id;
  const canUndo = history.length > 1;

  useEffect(() => {
    preloadImages(edOrHumzaPreloadPaths("phone"));
  }, []);

  function push(next: TierPlacement[]) {
    setHistory((currentHistory) => [...currentHistory, next]);
    setExpanded(false);
  }

  function place(tierId: string, itemId = current?.id) {
    if (!editable || !itemId) return;
    push(assignQuote(placements, itemId, tierId));
  }

  function takeBack(itemId: string) {
    if (!editable) return;
    push(unassignQuote(placements, itemId));
  }

  useEffect(() => {
    if (!editable) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (leftId && currentId) {
          setHistory((currentHistory) => {
            const latest = currentHistory[currentHistory.length - 1] ?? [];
            return [...currentHistory, assignQuote(latest, currentId, leftId)];
          });
          setExpanded(false);
        }
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (rightId && currentId) {
          setHistory((currentHistory) => {
            const latest = currentHistory[currentHistory.length - 1] ?? [];
            return [...currentHistory, assignQuote(latest, currentId, rightId)];
          });
          setExpanded(false);
        }
      } else if (event.key === "Backspace" && canUndo) {
        event.preventDefault();
        setHistory((currentHistory) =>
          currentHistory.length > 1 ? currentHistory.slice(0, -1) : currentHistory,
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, currentId, editable, leftId, rightId]);

  return (
    <section className="design-phone ed-or-humza" aria-label="Ed or Humza?">
      <QuestionTag play={play}>Quote sort</QuestionTag>
      <h1 className="phone-prompt">{question.prompt}</h1>
      <p className="ed-progress" role="status">
        {placements.length} of {question.items.length} sorted
      </p>
      {reveal ? (
        <RevealList question={question} reveal={reveal} placements={placements} />
      ) : (
        <>
          <QuoteStack
            item={current}
            editable={editable}
            expanded={expanded}
            onExpand={() => setExpanded((open) => !open)}
            left={left}
            right={right}
            reduce={motionSet.reduce}
            onSwipe={(side) => {
              const tier = side === "left" ? left : right;
              if (tier) place(tier.id);
            }}
          />
          {current && editable ? (
            <div className="ed-actions" role="group" aria-label="Who said this?">
              {question.tiers.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  className="ed-bucket motion-press"
                  data-tier={tier.id}
                  onClick={() => place(tier.id)}
                >
                  <PersonPhoto person={tier.id} size="avatar" decorative />
                  {tier.label}
                </button>
              ))}
            </div>
          ) : null}
          {!current && !locked ? (
            <p className="ed-help">
              Every quote has a home. Send the list, or tap a pile to change one.
            </p>
          ) : null}
          <div className="ed-toolbar">
            {editable && history.length > 1 ? (
              <button
                type="button"
                className="ed-undo motion-press"
                onClick={() =>
                  setHistory((currentHistory) => currentHistory.slice(0, -1))
                }
              >
                <Icon icon={undo} aria-hidden="true" />
                Undo
              </button>
            ) : null}
            {question.tiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                className="ed-pile"
                data-tier={tier.id}
                aria-expanded={review === tier.id}
                onClick={() =>
                  setReview((open) => (open === tier.id ? undefined : tier.id))
                }
              >
                <PersonPhoto person={tier.id} size="avatar" decorative />
                {tier.label} {countForTier(placements, tier.id)}
              </button>
            ))}
          </div>
          {review ? (
            <AssignedList
              question={question}
              placements={placements}
              tierId={review}
              editable={editable}
              onTakeBack={takeBack}
              onMove={(itemId, tierId) => place(tierId, itemId)}
            />
          ) : null}
        </>
      )}
      {controls.open || controls.pending || locked ? (
        <SubmitButton
          className={controls.dodge ? "troll-dodge" : ""}
          label="Send assignments"
          state={roundSubmitState(locked, controls.pending)}
          disabled={!locked && !ready}
          onClick={() => controls.onRank(placements)}
        />
      ) : null}
    </section>
  );
}

function QuoteStack({
  item,
  editable,
  expanded,
  onExpand,
  left,
  right,
  reduce,
  onSwipe,
}: {
  item: { id: string; label: string } | undefined;
  editable: boolean;
  expanded: boolean;
  onExpand: () => void;
  left?: { id: string; label: string };
  right?: { id: string; label: string };
  reduce: boolean;
  onSwipe: (side: "left" | "right") => void;
}) {
  const card = useRef<HTMLQuoteElement>(null);
  const start = useRef({ x: 0, y: 0, pointer: -1 });
  const long = Boolean(item && item.label.length > 110);
  const quoteId = useId();

  function resetTransform() {
    const node = card.current;
    if (!node) return;
    node.style.transform = "";
    node.style.transition = reduce
      ? "opacity 160ms ease"
      : "transform 280ms var(--ease-party, ease)";
  }

  function onPointerDown(event: PointerEvent<HTMLQuoteElement>) {
    if (!editable || !item) return;
    start.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.transition = "none";
  }

  function onPointerMove(event: PointerEvent<HTMLQuoteElement>) {
    if (start.current.pointer !== event.pointerId || !card.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    const tilt = reduce ? 0 : dx * 0.04;
    card.current.style.transform = `translate3d(${dx}px, ${dy * 0.12}px, 0) rotate(${tilt}deg)`;
  }

  function onPointerUp(event: PointerEvent<HTMLQuoteElement>) {
    if (start.current.pointer !== event.pointerId) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current.pointer = -1;
    const width = card.current?.offsetWidth ?? 320;
    const decision = swipeDecision(dx, dy, width);
    resetTransform();
    if (decision) onSwipe(decision);
  }

  if (!item) {
    return <p className="ed-card ed-card-empty">All quotes assigned.</p>;
  }

  return (
    <figure className="ed-stack">
      <blockquote
        ref={card}
        className="ed-card"
        aria-labelledby={quoteId}
        data-expanded={expanded || !long ? "" : undefined}
        style={{ touchAction: editable ? "pan-y" : "manipulation" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p id={quoteId}>{item.label}</p>
      </blockquote>
      {long ? (
        <button type="button" className="ed-expand" onClick={onExpand}>
          {expanded ? "Show less" : "Show full quote"}
        </button>
      ) : null}
      {editable ? (
        <p className="ed-help">
          Swipe towards {left?.label ?? "the first person"} or{" "}
          {right?.label ?? "the second"}, or tap a name. Arrow keys and E / H work too.
        </p>
      ) : null}
    </figure>
  );
}

function AssignedList({
  question,
  placements,
  tierId,
  editable,
  onTakeBack,
  onMove,
}: {
  question: RankQuestion;
  placements: TierPlacement[];
  tierId: string;
  editable: boolean;
  onTakeBack: (itemId: string) => void;
  onMove: (itemId: string, tierId: string) => void;
}) {
  const tier = question.tiers.find((entry) => entry.id === tierId);
  const other = question.tiers.find((entry) => entry.id !== tierId);
  const rows = placements.filter((entry) => entry.tierId === tierId);
  return (
    <ul className="ed-assigned" aria-label={`${tier?.label ?? "Assigned"} quotes`}>
      <li className="ed-assigned-head">
        <PersonPhoto person={tierId} size="avatar" decorative />
        <span>{tier?.label ?? "Assigned"}</span>
      </li>
      {rows.length === 0 ? <li>None yet.</li> : null}
      {rows.map((entry) => {
        const item = question.items.find((quote) => quote.id === entry.itemId);
        if (!item) return null;
        return (
          <li key={item.id}>
            <span>{item.label}</span>
            {editable ? (
              <span className="ed-assigned-actions">
                <button type="button" onClick={() => onTakeBack(item.id)}>
                  <Icon icon={chevronLeft} aria-hidden="true" /> Move back
                </button>
                {other ? (
                  <button type="button" onClick={() => onMove(item.id, other.id)}>
                    Move to {other.label}
                  </button>
                ) : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RevealList({
  question,
  reveal,
  placements,
}: {
  question: RankQuestion;
  reveal: RankReveal;
  placements: TierPlacement[];
}) {
  return (
    <div className="ed-reveal-phone">
      {question.tiers.map((tier) => {
        const truth =
          reveal.order.find((group) => group.tierId === tier.id)?.itemIds ?? [];
        return (
          <section key={tier.id} aria-label={`${tier.label} said`}>
            <h2>
              <PersonPhoto person={tier.id} size="avatar" decorative />
              {tier.label}
            </h2>
            <ul>
              {question.items
                .filter((item) => truth.includes(item.id))
                .map((item) => {
                  const guess = placements.find(
                    (entry) => entry.itemId === item.id,
                  )?.tierId;
                  const right = guess === tier.id;
                  return (
                    <li key={item.id} data-correct={right ? "" : undefined}>
                      {item.label}
                      {guess ? (
                        <span>
                          {right
                            ? "You had this right"
                            : `You put this with ${question.tiers.find((entry) => entry.id === guess)?.label}`}
                        </span>
                      ) : (
                        <span>You did not sort this one</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SortStage({
  play,
  question,
  reveal,
}: {
  play: PlaySnapshot;
  question: RankQuestion;
  reveal: RankReveal | undefined;
}) {
  const motionSet = useDesignMotion();
  useEffect(() => {
    preloadImages(edOrHumzaPreloadPaths("stage"));
  }, []);
  return (
    <section className="design-stage ed-or-humza-stage" aria-label="Ed or Humza?">
      <QuestionTag play={play}>Quote sort</QuestionTag>
      <StagePrompt text={question.prompt} />
      {!reveal ? (
        <p className="design-stage-line">
          Sort every quote on your phone.{" "}
          <LiveCount
            value={play.submissionCount}
            one="list locked in"
            many="lists locked in"
          />
        </p>
      ) : null}
      <div className="ed-stage-columns">
        {question.tiers.map((tier, column) => {
          const ids =
            reveal?.order.find((group) => group.tierId === tier.id)?.itemIds ?? [];
          const quotes = question.items.filter((item) => ids.includes(item.id));
          return (
            <div key={tier.id} className="ed-stage-column" data-tier={tier.id}>
              <PersonPhoto person={tier.id} size="portrait" />
              <h2>{tier.label}</h2>
              {reveal ? (
                <ul>
                  {quotes.map((item, index) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: motionSet.move(18) }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...motionSet.soft,
                        delay: motionSet.delay(0.05 * index + 0.12 * column),
                      }}
                    >
                      {item.label}
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p>Waiting for the reveal.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PersonPhoto({
  person,
  size,
  decorative = false,
}: {
  person: string;
  size: "avatar" | "portrait";
  decorative?: boolean;
}) {
  if (!isEdOrHumzaPerson(person)) {
    return null;
  }
  const asset = edOrHumzaPhotos[person][size];
  return (
    <img
      className={size === "portrait" ? "ed-stage-photo" : "ed-face"}
      src={asset.src}
      alt={decorative ? "" : asset.alt}
      width={asset.width}
      height={asset.height}
      decoding="async"
      draggable={false}
    />
  );
}
