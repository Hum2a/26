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
                ? "Blocks one item hit for 5 seconds"
                : item === "oil"
                  ? "Drop oil behind you to slow a kart"
                  : item === "tennis"
                    ? "Throw a bouncing tennis ball ahead"
                    : item === "bomb"
                      ? "Drop a bomb — move away before its fuse ends"
                      : item === "homing"
                        ? "Targets a racer ahead; gives a small boost if nobody is ahead"
                        : "A personal 0.6-second boost — hold A"
            : "Drive through a glowing item box to collect an item")}
      </p>
    </div>
  );
}
