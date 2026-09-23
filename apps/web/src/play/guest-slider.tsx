import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";

export function GuestSlider({
  play,
  open,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
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
      onSubmit={onSubmit}
    />
  );
}

function SliderControl({
  question,
  accepted,
  open,
  onSubmit,
}: {
  question: Extract<PlaySnapshot["question"], { kind: "slider" }>;
  accepted: number | undefined;
  open: boolean;
  onSubmit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(accepted ?? question.initial);

  function move(next: number) {
    const clamped = Math.min(question.maximum, Math.max(question.minimum, next));
    const steps = Math.round((clamped - question.minimum) / question.step);
    setDraft(question.minimum + steps * question.step);
  }

  return (
    <div className="grid gap-3">
      <p className="text-2xl font-bold">
        {draft} {question.unit}
      </p>
      <label className="grid gap-2 font-bold">
        Estimate
        <input
          className="min-h-11 w-full"
          type="range"
          min={question.minimum}
          max={question.maximum}
          step={question.step}
          value={draft}
          disabled={!open}
          aria-valuetext={`${draft} ${question.unit}`}
          onChange={(event) => move(Number(event.target.value))}
        />
      </label>
      <p>Arrow keys move by {question.step}. Sending stores this number.</p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!open}
          onClick={() => move(draft - question.step)}
        >
          Lower
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!open}
          onClick={() => move(draft + question.step)}
        >
          Higher
        </Button>
      </div>
      {open ? (
        <Button type="button" onClick={() => onSubmit(draft)}>
          Send estimate
        </Button>
      ) : null}
    </div>
  );
}
