import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../rounds/SubmitButton";
import { roundSubmitState } from "../rounds/submit-state";
import { SliderField } from "../rounds/Slider";

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
      <p>Arrow keys move by {question.step}. Sending stores this number.</p>
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
