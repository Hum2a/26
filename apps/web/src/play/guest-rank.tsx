import { GuestOrdered } from "./guest-ordered";
import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import { TierAssign, type TierPlacement } from "./controls/TierAssign";

export function GuestRank({
  play,
  open,
  pending,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
  pending: boolean;
  onSubmit: (placements: TierPlacement[]) => void;
}) {
  const question = play.question;
  if (question.kind !== "rank") {
    return null;
  }
  const accepted =
    play.selfAnswer?.kind === "rank" ? play.selfAnswer.placements : undefined;
  if (question.input === "ordered")
    return (
      <GuestOrdered
        key={`${question.id}-${accepted ? "sent" : "open"}`}
        question={question}
        accepted={accepted}
        open={open}
        pending={pending}
        onSubmit={onSubmit}
      />
    );
  return (
    <RankControl
      key={`${question.id}-${accepted ? "sent" : "open"}`}
      question={question}
      accepted={accepted}
      open={open}
      pending={pending}
      onSubmit={onSubmit}
    />
  );
}

function RankControl({
  question,
  accepted,
  open,
  pending,
  onSubmit,
}: {
  question: Extract<PlaySnapshot["question"], { kind: "rank" }>;
  accepted: TierPlacement[] | undefined;
  open: boolean;
  pending: boolean;
  onSubmit: (placements: TierPlacement[]) => void;
}) {
  const [placements, setPlacements] = useState<TierPlacement[]>(accepted ?? []);
  const locked = accepted !== undefined;
  const ready =
    question.mode === "partial"
      ? placements.length > 0
      : question.items.every((item) =>
          placements.some((placement) => placement.itemId === item.id),
        );

  return (
    <div className="grid gap-3">
      <TierAssign
        items={question.items}
        tiers={question.tiers}
        ties={question.ties}
        open={open}
        initial={accepted ?? []}
        onPlacements={setPlacements}
      />
      {open || pending || locked ? (
        <SubmitButton
          label="Send ranking"
          state={roundSubmitState(locked, pending)}
          disabled={!ready}
          onClick={() => onSubmit(placements)}
        />
      ) : null}
    </div>
  );
}
