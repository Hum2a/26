import { TextField } from "../ui/primitives";
import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import { SliderField } from "./controls/Slider";

export function GuestSlider({
  play,
  open,
  pending,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
  pending: boolean;
  onSubmit: (value: number) => void;
}) {
  const question = play.question;
  if (question.kind !== "slider") {
    return null;
  }
  if (question.input === "number")
    return (
      <NumberControl
        key={`${question.id}-${play.selfAnswer ? "sent" : "open"}`}
        question={question}
        accepted={
          play.selfAnswer?.kind === "slider" ? play.selfAnswer.value : undefined
        }
        open={open}
        pending={pending}
        onSubmit={onSubmit}
      />
    );
  return (
    <SliderControl
      key={`${question.id}-${
        play.selfAnswer?.kind === "slider" ? play.selfAnswer.value : "draft"
      }`}
      question={question}
      accepted={play.selfAnswer?.kind === "slider" ? play.selfAnswer.value : undefined}
      open={open}
      pending={pending}
      onSubmit={onSubmit}
    />
  );
}

function SliderControl({
  question,
  accepted,
  open,
  pending,
  onSubmit,
}: {
  question: Extract<PlaySnapshot["question"], { kind: "slider" }>;
  accepted: number | undefined;
  open: boolean;
  pending: boolean;
  onSubmit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(accepted ?? question.initial);
  const locked = accepted !== undefined;
  return (
    <div className="grid gap-3">
      <SliderField
        value={draft}
        unit={question.unit}
        minimum={question.minimum}
        maximum={question.maximum}
        step={question.step}
        disabled={!open}
        onChange={setDraft}
      />
      <p>Drag to choose your estimate. Arrow keys move by {question.step}.</p>
      {open || pending || locked ? (
        <SubmitButton
          label="Send estimate"
          state={roundSubmitState(locked, pending)}
          onClick={() => onSubmit(draft)}
        />
      ) : null}
    </div>
  );
}

function NumberControl({
  question,
  accepted,
  open,
  pending,
  onSubmit,
}: {
  question: Extract<PlaySnapshot["question"], { kind: "slider" }>;
  accepted?: number;
  open: boolean;
  pending: boolean;
  onSubmit: (value: number) => void;
}) {
  const [body, setBody] = useState(accepted === undefined ? "" : accepted.toFixed(2));
  const value = Number(body);
  const valid =
    /^\d+(?:\.\d{1,2})?$/.test(body) &&
    Number.isFinite(value) &&
    value >= question.minimum &&
    value <= question.maximum &&
    Math.abs(
      (value - question.minimum) / question.step -
        Math.round((value - question.minimum) / question.step),
    ) < 1e-7;
  return (
    <div className="grid gap-4">
      <TextField
        label="Your price (£)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={body}
        disabled={!open}
        onChange={(event) => setBody(event.target.value)}
        hint={`£${question.minimum.toFixed(2)} to £${question.maximum.toFixed(2)} · up to two decimal places`}
      />
      <p>
        Closest without going over wins. Tied closest guesses share the win; everyone
        over means no winner.
      </p>
      {open || pending || accepted !== undefined ? (
        <SubmitButton
          label="Lock in price"
          disabled={!valid}
          state={roundSubmitState(accepted !== undefined, pending)}
          onClick={() => onSubmit(value)}
        />
      ) : null}
    </div>
  );
}
