import type { TierPlacement } from "./TierAssign";
import { Button } from "../../ui/primitives";

/** Each quote is assigned independently; there is no ordering within a person. */
export function BucketAssign({
  items,
  tiers,
  placements,
  open,
  onPlacements,
}: {
  items: { id: string; label: string }[];
  tiers: { id: string; label: string }[];
  placements: TierPlacement[];
  open: boolean;
  onPlacements: (placements: TierPlacement[]) => void;
}) {
  return (
    <div className="grid gap-4">
      <p role="status">
        {placements.length} / {items.length} assigned. Pick a person for every quote,
        then send.
      </p>
      {items.map((item, index) => (
        <fieldset
          key={item.id}
          className="min-w-0 rounded-xl border border-current/20 p-3"
        >
          <legend className="max-w-full whitespace-normal break-words px-1">
            {index + 1}. {item.label}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {tiers.map((tier) => {
              const selected = placements.some(
                (entry) => entry.itemId === item.id && entry.tierId === tier.id,
              );
              return (
                <Button
                  key={tier.id}
                  type="button"
                  variant={selected ? "primary" : "secondary"}
                  aria-pressed={selected}
                  disabled={!open}
                  onClick={() =>
                    onPlacements([
                      ...placements.filter((entry) => entry.itemId !== item.id),
                      { itemId: item.id, tierId: tier.id },
                    ])
                  }
                >
                  {tier.label}
                </Button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
