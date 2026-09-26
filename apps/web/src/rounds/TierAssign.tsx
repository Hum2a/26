import { useState } from "react";
import { Button } from "../ui/primitives";
import { OptionText } from "./OptionText";
import "./option-text.css";

export type TierPlacement = { itemId: string; tierId: string };

function assignTier(
  current: TierPlacement[],
  itemId: string,
  tierId: string,
  ties: "forbidden" | "shared",
): TierPlacement[] {
  const withoutItem = current.filter((placement) => placement.itemId !== itemId);
  const withoutTier =
    ties === "forbidden"
      ? withoutItem.filter((placement) => placement.tierId !== tierId)
      : withoutItem;
  return [...withoutTier, { itemId, tierId }];
}

export function TierAssign({
  items,
  tiers,
  ties,
  open,
  initial = [],
  onPlacements,
}: {
  items: { id: string; label: string }[];
  tiers: { id: string; label: string }[];
  ties: "forbidden" | "shared";
  open: boolean;
  initial?: TierPlacement[];
  onPlacements?: (placements: TierPlacement[]) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [history, setHistory] = useState<TierPlacement[][]>([initial]);
  const placements = history[history.length - 1] ?? [];

  function place(tierId: string) {
    if (!selected) {
      return;
    }
    const next = assignTier(placements, selected, tierId, ties);
    setHistory((current) => [...current, next]);
    setSelected(undefined);
    onPlacements?.(next);
  }

  function undo() {
    if (history.length <= 1) {
      return;
    }
    const next = history.slice(0, -1);
    setHistory(next);
    onPlacements?.(next[next.length - 1] ?? []);
  }

  return (
    <div className="grid gap-3">
      <p>Tap an item, then tap its position.</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const pressed = selected === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              className={pressed ? "option-button tier-selected" : "option-button"}
              variant={pressed ? "primary" : "secondary"}
              aria-pressed={pressed}
              disabled={!open}
              onClick={() =>
                setSelected((current) => (current === item.id ? undefined : item.id))
              }
            >
              <OptionText text={item.label} />
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {tiers.map((tier) => {
          const count = placements.filter(
            (placement) => placement.tierId === tier.id,
          ).length;
          return (
            <Button
              key={tier.id}
              type="button"
              variant="secondary"
              aria-label={tier.label}
              disabled={!open || !selected}
              onClick={() => place(tier.id)}
            >
              {tier.label}
              <span className="tier-count" aria-hidden="true">
                {count}
              </span>
            </Button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!open || history.length <= 1}
        onClick={undo}
      >
        Undo last
      </Button>
      <ul className="grid gap-1">
        {placements.map((placement) => (
          <li key={placement.itemId}>
            {items.find((item) => item.id === placement.itemId)?.label} ·{" "}
            {tiers.find((tier) => tier.id === placement.tierId)?.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
