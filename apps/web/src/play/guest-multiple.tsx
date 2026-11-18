import { useState } from "react";
import { motion } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import { useDesignMotion } from "./designs/kit";
import { optionMark } from "../theme/identity";
import { useThemeIdentity } from "../theme/use-theme-identity";

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
  // The projector's marks, so a ticked answer matches the big screen. This
  // grid has always lettered its tiles A, B, C, so "stage" keeps 26 basic's
  // classic letters here; every other style is the same on both surfaces.
  const { marks } = useThemeIdentity();
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
                {optionMark(marks, index, "stage")}
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
