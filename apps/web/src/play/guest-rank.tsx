import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";

type Placement = { itemId: string; tierId: string };

export function GuestRank({
  play,
  open,
  onSubmit,
}: {
  play: PlaySnapshot;
  open: boolean;
  onSubmit: (placements: Placement[]) => void;
}) {
  const question = play.question;
  if (question.kind !== "rank") {
    return null;
  }
  const accepted =
    play.selfAnswer?.kind === "rank" ? play.selfAnswer.placements : undefined;
  return (
    <RankControl
      key={`${question.id}-${accepted ? "sent" : "open"}`}
      question={question}
      accepted={accepted}
      open={open}
      onSubmit={onSubmit}
    />
  );
}

function RankControl({
  question,
  accepted,
  open,
  onSubmit,
}: {
  question: Extract<PlaySnapshot["question"], { kind: "rank" }>;
  accepted: Placement[] | undefined;
  open: boolean;
  onSubmit: (placements: Placement[]) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [placements, setPlacements] = useState<Placement[]>(accepted ?? []);
  const ready =
    question.mode === "partial"
      ? placements.length > 0
      : question.items.every((item) =>
          placements.some((placement) => placement.itemId === item.id),
        );

  function place(tierId: string) {
    if (!selected) {
      return;
    }
    setPlacements((current) => {
      const withoutItem = current.filter((placement) => placement.itemId !== selected);
      const withoutTier =
        question.ties === "forbidden"
          ? withoutItem.filter((placement) => placement.tierId !== tierId)
          : withoutItem;
      return [...withoutTier, { itemId: selected, tierId }];
    });
    setSelected(undefined);
  }

  return (
    <div className="grid gap-3">
      <p>Tap an item, then tap its position.</p>
      <div className="flex flex-wrap gap-2">
        {question.items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={selected === item.id ? "primary" : "secondary"}
            aria-pressed={selected === item.id}
            disabled={!open}
            onClick={() =>
              setSelected((current) => (current === item.id ? undefined : item.id))
            }
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {question.tiers.map((tier) => (
          <Button
            key={tier.id}
            type="button"
            variant="secondary"
            disabled={!open || !selected}
            onClick={() => place(tier.id)}
          >
            {tier.label}
          </Button>
        ))}
      </div>
      <ul className="grid gap-1">
        {(accepted ?? placements).map((placement) => (
          <li key={placement.itemId}>
            {question.items.find((item) => item.id === placement.itemId)?.label} ·{" "}
            {question.tiers.find((tier) => tier.id === placement.tierId)?.label}
          </li>
        ))}
      </ul>
      {open ? (
        <Button type="button" disabled={!ready} onClick={() => onSubmit(placements)}>
          Send ranking
        </Button>
      ) : null}
    </div>
  );
}
