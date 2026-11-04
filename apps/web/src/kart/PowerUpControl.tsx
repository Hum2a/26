import { kartItemNames, type KartItem } from "@26/shared";
import { Button } from "../ui/primitives";
export function PowerUpControl({
  item,
  pending = false,
  disabled = false,
  notice = "",
  effect = "",
  onUse,
}: {
  item: KartItem | null;
  pending?: boolean;
  disabled?: boolean;
  notice?: string;
  effect?: string;
  onUse: () => void;
}) {
  return (
    <div className="kart-power-control" aria-label="Power-up inventory">
      <Button
        variant={item ? "primary" : "secondary"}
        disabled={disabled || pending || !item}
        onPointerDown={(event) => event.preventDefault()}
        onClick={onUse}
      >
        {pending ? "Using…" : item ? "Use " + kartItemNames[item] : "No power-up"}
      </Button>
      <p role="status" data-hint={effect || notice ? undefined : ""}>
        {effect ||
          notice ||
          (item
            ? item === "turbo"
              ? "A short burst of speed — hold A"
              : item === "shield"
                ? "Blocks one oil slick for 5 seconds"
                : "Drop oil behind you to slow a kart"
            : "Drive through a glowing item box to collect an item")}
      </p>
    </div>
  );
}
