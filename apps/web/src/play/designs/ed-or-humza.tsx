import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import undo from "@iconify-icons/lucide/undo-2";
import chevronLeft from "@iconify-icons/lucide/chevron-left";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import type { TierPlacement } from "../controls/TierAssign";
import type { PhoneControls, PresentationProps } from "../presentation";
import { LiveCount, QuestionTag, StagePrompt, useDesignMotion } from "./kit";
import {
  assignQuote,
  countForTier,
  isLongQuote,
  lockSwipeAxis,
  nextUnassigned,
  swipeDecision,
  swipeProgress,
  unassignQuote,
  undoPlacements,
  type SwipeAxis,
} from "./ed-or-humza-assign";
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

  const place = useCallback(
    (tierId: string, itemId = currentId) => {
      if (!editable || !itemId) return;
      setHistory((currentHistory) => {
        const latest = currentHistory[currentHistory.length - 1] ?? [];
        return [...currentHistory, assignQuote(latest, itemId, tierId)];
      });
      setExpanded(false);
    },
    [currentId, editable],
  );

  const takeBack = useCallback(
    (itemId: string) => {
      if (!editable) return;
      setHistory((currentHistory) => {
        const latest = currentHistory[currentHistory.length - 1] ?? [];
        return [...currentHistory, unassignQuote(latest, itemId)];
      });
      setExpanded(false);
    },
    [editable],
  );

  const undoLast = useCallback(() => {
    if (!editable) return;
    setHistory((currentHistory) => undoPlacements(currentHistory));
    setExpanded(false);
  }, [editable]);

  useEffect(() => {
    if (!editable) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (leftId && currentId) {
          place(leftId, currentId);
        }
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (rightId && currentId) {
          place(rightId, currentId);
        }
      } else if (event.key === "Backspace" && canUndo) {
        event.preventDefault();
        undoLast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, currentId, editable, leftId, place, rightId, undoLast]);

  return (
    <section className="design-phone ed-or-humza" aria-label="Ed or Humza?">
      <div className="ed-main">
        <QuestionTag play={play}>Quote sort</QuestionTag>
        <h1 className="phone-prompt">{question.prompt}</h1>
        <p className="ed-progress" role="status">
          {placements.length} of {question.items.length} sorted
        </p>
        {reveal ? (
          <RevealList question={question} reveal={reveal} placements={placements} />
        ) : (
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
        )}
      </div>
      {!reveal ? (
        <div className="ed-controls">
          {current && editable ? (
            <div className="ed-actions" role="group" aria-label="Who said this?">
              {question.tiers.map((tier, index) => (
                <button
                  key={tier.id}
                  type="button"
                  className="ed-bucket motion-press"
                  data-tier={tier.id}
                  data-side={index === 0 ? "left" : "right"}
                  onClick={() => place(tier.id)}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          ) : null}
          {!current && !locked ? (
            <p className="ed-help ed-done-help">
              Every quote has a home. Send the list, or tap a pile to change one.
            </p>
          ) : null}
          <div className="ed-toolbar">
            {editable && canUndo ? (
              <button type="button" className="ed-undo motion-press" onClick={undoLast}>
                <Icon icon={undo} aria-hidden="true" />
                <span>Undo</span>
              </button>
            ) : null}
            {question.tiers.map((tier, index) => (
              <button
                key={tier.id}
                type="button"
                className="ed-pile motion-press"
                data-tier={tier.id}
                data-side={index === 0 ? "left" : "right"}
                data-open={review === tier.id ? "" : undefined}
                aria-expanded={review === tier.id}
                onClick={() =>
                  setReview((open) => (open === tier.id ? undefined : tier.id))
                }
              >
                <span>{tier.label}</span>{" "}
                <span className="ed-pile-count">
                  {countForTier(placements, tier.id)}
                </span>
              </button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {review ? (
              <motion.div
                key={review}
                className="ed-assigned-panel"
                initial={{ opacity: 0, y: motionSet.move(8) }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: motionSet.move(6) }}
                transition={motionSet.reduce ? { duration: 0.14 } : motionSet.spring}
              >
                <AssignedList
                  question={question}
                  placements={placements}
                  tierId={review}
                  editable={editable}
                  onTakeBack={takeBack}
                  onMove={(itemId, tierId) => place(tierId, itemId)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {controls.open || controls.pending || locked ? (
            <div className="ed-submit-wrap">
              <SubmitButton
                className={controls.dodge ? "troll-dodge" : ""}
                label="Send assignments"
                state={roundSubmitState(locked, controls.pending)}
                disabled={!locked && !ready}
                onClick={() => {
                  if (editable && ready) controls.onRank(placements);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : controls.open || controls.pending || locked ? (
        <div className="ed-submit-wrap">
          <SubmitButton
            className={controls.dodge ? "troll-dodge" : ""}
            label="Send assignments"
            state={roundSubmitState(locked, controls.pending)}
            disabled={!locked && !ready}
            onClick={() => {
              if (editable && ready) controls.onRank(placements);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  width: number;
  axis: SwipeAxis;
  captured: boolean;
  dx: number;
  dy: number;
  rafId: number;
}

function emptyDrag(): DragState {
  return {
    pointerId: -1,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    width: 320,
    axis: null,
    captured: false,
    dx: 0,
    dy: 0,
    rafId: 0,
  };
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
  const leftStamp = useRef<HTMLSpanElement>(null);
  const rightStamp = useRef<HTMLSpanElement>(null);
  const drag = useRef<DragState>(emptyDrag());
  const long = Boolean(item && isLongQuote(item.label, 110));
  const quoteId = useId();

  const cancelFrame = useCallback(() => {
    if (drag.current.rafId) {
      cancelAnimationFrame(drag.current.rafId);
      drag.current.rafId = 0;
    }
  }, []);

  const resetVisuals = useCallback(
    (animate: boolean) => {
      cancelFrame();
      const node = card.current;
      if (node) {
        delete node.dataset.dragging;
        node.style.transition = animate
          ? reduce
            ? "opacity 150ms ease"
            : "transform 240ms var(--ease-party, cubic-bezier(0.2, 0.8, 0.2, 1))"
          : "none";
        node.style.transform = "";
      }
      if (leftStamp.current) leftStamp.current.style.opacity = "0";
      if (rightStamp.current) rightStamp.current.style.opacity = "0";
    },
    [cancelFrame, reduce],
  );

  useEffect(() => {
    drag.current = emptyDrag();
    return () => {
      cancelFrame();
    };
  }, [cancelFrame, item?.id]);

  function applyDragFrame() {
    drag.current.rafId = 0;
    const node = card.current;
    if (!node || drag.current.pointerId === -1) return;
    const { dx, dy, width } = drag.current;
    const tilt = reduce ? 0 : Math.max(-12, Math.min(12, dx * 0.045));
    node.style.transform = `translate3d(${dx}px, ${dy * 0.08}px, 0) rotate(${tilt}deg)`;
    const progress = swipeProgress(dx, width);
    if (leftStamp.current) {
      leftStamp.current.style.opacity =
        progress < 0 ? String(Math.min(1, Math.abs(progress))) : "0";
    }
    if (rightStamp.current) {
      rightStamp.current.style.opacity =
        progress > 0 ? String(Math.min(1, progress)) : "0";
    }
  }

  function releaseCapture(node: HTMLElement, pointerId: number) {
    if (!drag.current.captured) return;
    drag.current.captured = false;
    try {
      if (node.hasPointerCapture?.(pointerId)) {
        node.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore if pointer already ended or synthetic event in tests.
    }
  }

  function onPointerDown(event: PointerEvent<HTMLQuoteElement>) {
    if (!editable || !item || event.button > 0) return;
    cancelFrame();
    const now = event.timeStamp || performance.now();
    // Read layout once on pointerdown before any style writes (zero layout thrash).
    const width = event.currentTarget.offsetWidth || 320;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: now,
      lastX: event.clientX,
      lastTime: now,
      velocityX: 0,
      width,
      axis: null,
      captured: false,
      dx: 0,
      dy: 0,
      rafId: 0,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLQuoteElement>) {
    const state = drag.current;
    if (state.pointerId !== event.pointerId || !card.current) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.axis === null) {
      const axis = lockSwipeAxis(dx, dy);
      if (axis === null) return;
      state.axis = axis;
      if (axis === "vertical") {
        // Yield cleanly to vertical page or quote scroll.
        state.pointerId = -1;
        return;
      }
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        state.captured = true;
      } catch {
        // Synthetic pointer events in tests may not support pointer capture.
      }
      card.current.style.transition = "none";
      card.current.dataset.dragging = "true";
    }

    const now = event.timeStamp || performance.now();
    const dt = now - state.lastTime;
    if (dt >= 4) {
      const instant = (event.clientX - state.lastX) / dt;
      state.velocityX =
        state.velocityX === 0 ? instant : state.velocityX * 0.45 + instant * 0.55;
      state.lastX = event.clientX;
      state.lastTime = now;
    }

    state.dx = dx;
    state.dy = dy;
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(applyDragFrame);
    }
  }

  function onPointerUp(event: PointerEvent<HTMLQuoteElement>) {
    const state = drag.current;
    if (state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const now = event.timeStamp || performance.now();
    const elapsed = Math.max(1, now - state.startTime);
    const { axis, width, velocityX } = state;

    releaseCapture(event.currentTarget, event.pointerId);
    state.pointerId = -1;

    const decision =
      axis === "vertical"
        ? null
        : swipeDecision(
            dx,
            dy,
            width,
            elapsed,
            velocityX !== 0 ? velocityX : undefined,
          );

    if (decision) {
      resetVisuals(false);
      onSwipe(decision);
    } else {
      resetVisuals(true);
    }
  }

  function onPointerCancel(event: PointerEvent<HTMLQuoteElement>) {
    const state = drag.current;
    if (state.pointerId !== event.pointerId) return;
    releaseCapture(event.currentTarget, event.pointerId);
    state.pointerId = -1;
    resetVisuals(true);
  }

  if (!item) {
    return <p className="ed-card ed-card-empty">All quotes assigned.</p>;
  }

  return (
    <figure className="ed-stack">
      <motion.blockquote
        key={item.id}
        ref={card}
        className="ed-card"
        aria-labelledby={quoteId}
        data-editable={editable ? "" : undefined}
        data-expanded={expanded || !long ? "" : undefined}
        initial={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduce ? { duration: 0.14 } : { type: "spring", stiffness: 420, damping: 32 }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="ed-card-stamps" aria-hidden="true">
          <span
            ref={leftStamp}
            className="ed-stamp"
            data-tier={left?.id}
            data-side="left"
          >
            {left?.label}
          </span>
          <span
            ref={rightStamp}
            className="ed-stamp"
            data-tier={right?.id}
            data-side="right"
          >
            {right?.label}
          </span>
        </div>
        <p id={quoteId}>{item.label}</p>
      </motion.blockquote>
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
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const tier = question.tiers.find((entry) => entry.id === tierId);
  const other = question.tiers.find((entry) => entry.id !== tierId);
  const rows = placements.filter((entry) => entry.tierId === tierId);

  function toggleRow(itemId: string) {
    setExpandedIds((current) => ({ ...current, [itemId]: !current[itemId] }));
  }

  return (
    <ul className="ed-assigned" aria-label={`${tier?.label ?? "Assigned"} quotes`}>
      {rows.length === 0 ? <li className="ed-assigned-empty">None yet.</li> : null}
      {rows.map((entry) => {
        const item = question.items.find((quote) => quote.id === entry.itemId);
        if (!item) return null;
        const long = isLongQuote(item.label, 72);
        const isExpanded = Boolean(expandedIds[item.id]);
        return (
          <li key={item.id}>
            {long ? (
              <button
                type="button"
                className="ed-assigned-quote"
                aria-expanded={isExpanded}
                data-expanded={isExpanded ? "" : undefined}
                onClick={() => toggleRow(item.id)}
              >
                <span className="ed-assigned-quote-text">{item.label}</span>
                <span className="ed-assigned-quote-toggle">
                  {isExpanded ? "Show less" : "Tap to read full quote"}
                </span>
              </button>
            ) : (
              <span className="ed-assigned-quote-plain">{item.label}</span>
            )}
            {editable ? (
              <span className="ed-assigned-actions">
                <button
                  type="button"
                  className="motion-press"
                  onClick={() => onTakeBack(item.id)}
                >
                  <Icon icon={chevronLeft} aria-hidden="true" />
                  <span>Move back</span>
                </button>
                {other ? (
                  <button
                    type="button"
                    className="motion-press"
                    onClick={() => onMove(item.id, other.id)}
                  >
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
            <h2>{tier.label}</h2>
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
