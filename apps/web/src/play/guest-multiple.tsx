import { useState } from "react";
import { motion } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";
import { SubmitButton } from "../rounds/SubmitButton";
import { roundSubmitState } from "../rounds/submit-state";
import { useDesignMotion } from "./designs/kit";

export function GuestMultiple({
  play,
  open,
  pending,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const motionKit = useDesignMotion();
  if (play.question.kind !== "choice") return null;
  const accepted =
    play.selfAnswer?.kind === "multiple" ? play.selfAnswer.optionIds : undefined;
  const chosen = accepted ?? draft;
  const reveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  return (
    <div className="grid gap-3">
      <p role="status">{chosen.length} selected · select every answer that applies</p>
      <div className="question-choice-grid" data-count={play.question.options.length}>
        {play.question.options.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: motionKit.move(8) }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionKit.soft}
          >
            <Button
              className="option-button"
              aria-pressed={chosen.includes(option.id)}
              variant={chosen.includes(option.id) ? "primary" : "secondary"}
              disabled={!open}
              onClick={() =>
                setDraft((current) =>
                  current.includes(option.id)
                    ? current.filter((id) => id !== option.id)
                    : [...current, option.id],
                )
              }
            >
              <span className="question-choice-mark" aria-hidden="true">
                {String.fromCharCode(65 + index)}
              </span>
              {option.label}
              {reveal?.correctOptionIds?.includes(option.id) ? " — correct" : ""}
            </Button>
          </motion.div>
        ))}
      </div>
      {open || pending || accepted ? (
        <SubmitButton
          label="Send selections"
          state={roundSubmitState(Boolean(accepted), pending)}
          disabled={!chosen.length}
          onClick={() => onSubmit(JSON.stringify(chosen))}
        />
      ) : null}
    </div>
  );
}
