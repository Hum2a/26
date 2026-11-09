import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import { useReducedMotion, type Transition } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import type { PhoneControls } from "../presentation";
import "./kit.css";

/**
 * Shared motion for every question design. Reduced motion keeps a short fade
 * and drops movement, so a state change still never snaps.
 */
export function useDesignMotion() {
  const reduce = useReducedMotion() ?? false;
  const spring: Transition = reduce
    ? { duration: 0.2, ease: "easeOut" }
    : { type: "spring", stiffness: 380, damping: 30 };
  const soft: Transition = { duration: reduce ? 0.2 : 0.5, ease: [0.2, 0, 0, 1] };
  const slow: Transition = { duration: reduce ? 0.2 : 1.1, ease: [0.2, 0, 0, 1] };
  return {
    reduce,
    spring,
    soft,
    slow,
    /** Movement in pixels, or none under reduced motion. */
    move: (px: number) => (reduce ? 0 : px),
    /** A delay for a staged reveal, collapsed under reduced motion. */
    delay: (seconds: number) => (reduce ? 0 : seconds),
  };
}

export type ChoiceQuestionView = Extract<PlaySnapshot["question"], { kind: "choice" }>;
export type ChoiceReveal = Extract<
  NonNullable<PlaySnapshot["reveal"]>,
  { kind: "choice" }
>;

/** Everything a choice design needs. Nothing here knows the answer before the reveal. */
export function choiceView(play: PlaySnapshot, selectedId?: string) {
  const question = play.question;
  if (question.kind !== "choice") {
    return undefined;
  }
  const reveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const sent =
    play.selfAnswer?.kind === "choice" ? play.selfAnswer.optionId : undefined;
  const total = reveal?.tally?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  return {
    question,
    reveal,
    sent,
    chosen: sent ?? selectedId,
    total,
    isAnswer: (optionId: string) => reveal?.correctOptionId === optionId,
    scored: (optionId: string) =>
      Boolean(
        reveal &&
        (reveal.correctOptionId === optionId ||
          reveal.everyone ||
          reveal.winners?.includes(optionId)),
      ),
    count: (optionId: string) =>
      reveal?.tally?.find((row) => row.optionId === optionId)?.count ?? 0,
  };
}

export function ChoiceSend({
  play,
  controls,
  label = "Send answer",
}: {
  play: PlaySnapshot;
  controls: PhoneControls;
  label?: string;
}) {
  const locked = play.selfAnswer !== null;
  if (!(controls.open || controls.pending || locked)) {
    return null;
  }
  return (
    <SubmitButton
      className={controls.dodge ? "troll-dodge" : ""}
      label={label}
      state={roundSubmitState(locked, controls.pending)}
      disabled={!locked && !controls.selectedId}
      onClick={controls.onSubmit}
    />
  );
}

export type TypedQuestionView = Extract<PlaySnapshot["question"], { kind: "typed" }>;
export type TypedReveal = Extract<
  NonNullable<PlaySnapshot["reveal"]>,
  { kind: "typed" }
>;

export function typedView(play: PlaySnapshot) {
  const question = play.question;
  if (question.kind !== "typed") {
    return undefined;
  }
  return {
    question,
    reveal: play.reveal?.kind === "typed" ? play.reveal : undefined,
    sent: play.selfAnswer?.kind === "text" ? play.selfAnswer.body : undefined,
  };
}

/** Draft text for a typed design. The phone keeps the draft until it is sent. */
export function useTypedDraft(play: PlaySnapshot, controls: PhoneControls) {
  const [draft, setDraft] = useState("");
  const sent = useRef(false);
  const view = typedView(play);
  const locked = view?.sent !== undefined;
  const editable = controls.open && !locked;
  const ready = draft.trim().length > 0;

  useEffect(() => {
    if (!locked && !controls.pending) sent.current = false;
  }, [locked, controls.pending]);

  function send() {
    if (sent.current || !editable || controls.pending || !ready) return;
    sent.current = true;
    controls.onText(draft);
  }

  return {
    draft: view?.sent ?? draft,
    setDraft,
    editable,
    locked,
    maxLength: view?.question.maxLength ?? 80,
    send,
    ready,
  };
}

export function TypedSend({
  controls,
  typed,
  label,
}: {
  controls: PhoneControls;
  typed: ReturnType<typeof useTypedDraft>;
  label: string;
}) {
  if (!(controls.open || controls.pending || typed.locked)) {
    return null;
  }
  return (
    <SubmitButton
      className={controls.dodge ? "troll-dodge" : ""}
      label={label}
      state={roundSubmitState(typed.locked, controls.pending)}
      disabled={!typed.locked && !typed.ready}
      onClick={typed.send}
    />
  );
}

/**
 * The answer box for a typed design. The keyboard's Go key uses the same send
 * action as the button, and a second press is ignored.
 */
export function TypedField({
  typed,
  label,
  className = "",
  placeholder,
  children,
}: {
  typed: ReturnType<typeof useTypedDraft>;
  label: string;
  className?: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <form
      className={`typed-field ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        typed.send();
      }}
    >
      <label htmlFor={id} className="typed-field-label">
        {label}
      </label>
      <input
        id={id}
        className="typed-field-input"
        value={typed.draft}
        maxLength={typed.maxLength}
        disabled={!typed.editable}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="send"
        onChange={(event) => typed.setDraft(event.target.value)}
      />
      {children}
    </form>
  );
}

/** "What was their real name? Count Binface" names Count Binface. */
export function subjectFromPrompt(prompt: string): string {
  const tail = prompt.split("?").pop()?.trim();
  return tail && tail.length > 0 ? tail : prompt;
}

/** The typed result line for the stage. */
export function typedTally(reveal: TypedReveal): string {
  return `${reveal.correctCount} of ${reveal.responseCount} got it`;
}

/** Question number in the design's own voice. */
export function QuestionTag({
  play,
  children,
}: {
  play: PlaySnapshot;
  children?: ReactNode;
}) {
  return (
    <p className="design-tag">
      <span>
        Question {play.question.index} of {play.question.total}
      </span>
      {children ? <span className="design-tag-extra">{children}</span> : null}
    </p>
  );
}

/** The stage question. Long prompts step down a size so the design still fits a projector. */
export function StagePrompt({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const size = text.length > 110 ? "long" : text.length > 60 ? "medium" : undefined;
  return (
    <p className={`design-stage-prompt ${className}`} data-size={size}>
      {text}
    </p>
  );
}

/** A live count that rolls rather than jumps. */
export function Count({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return <NumberFlow className={className} value={value} />;
}

/** "3 answers in", with the number rolling. */
export function LiveCount({
  value,
  one,
  many,
}: {
  value: number;
  one: string;
  many: string;
}) {
  return (
    <>
      <Count value={value} /> {value === 1 ? one : many}
    </>
  );
}

export function isRevealPhase(phase: string): boolean {
  return (
    phase === "reveal" || phase === "scores" || phase === "final" || phase === "podium"
  );
}
