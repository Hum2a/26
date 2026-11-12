import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { kartItemNames, type KartItem } from "@26/shared";
import { Button } from "../ui/primitives";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { buzz } from "../device/haptics";

/** A picture for each item, for the roulette badge beside the button. */
export const itemIcons: Record<KartItem, string> = {
  turbo: "🚀",
  shield: "🫧",
  oil: "🛢️",
  tennis: "🎾",
  bomb: "💣",
  homing: "🎯",
  treat: "🍬",
};
/** How long the roulette spins before it lands on the real item. */
export const rouletteMs = 700;
const reel = Object.values(itemIcons);

/**
 * A short slot-machine spin when a new item arrives. The button already
 * shows and uses the real item; the spin is decoration and never blocks it.
 */
function ItemRoulette({ item }: { item: KartItem | null }) {
  const reduced = usePrefersReducedMotion();
  const previous = useRef<KartItem | null>(item);
  const [spin, setSpin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    const arrived = item !== null && previous.current === null;
    previous.current = item;
    if (!arrived) return;
    buzz(15);
    if (reduced) return;
    setSpinning(true);
    const tick = setInterval(() => setSpin((value) => value + 1), 80);
    const stop = setTimeout(() => {
      clearInterval(tick);
      setSpinning(false);
    }, rouletteMs);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [item, reduced]);
  const icon = item ? (spinning ? reel[spin % reel.length] : itemIcons[item]) : "·";
  return (
    <span
      className="kart-item-roulette"
      data-spinning={spinning || undefined}
      aria-hidden="true"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={spinning ? `spin-${spin}` : `item-${item ?? "none"}`}
          initial={{ opacity: 0, y: reduced ? 0 : -10 }}
          animate={{ opacity: 1, y: 0, scale: spinning || reduced ? 1 : [1.35, 1] }}
          exit={{ opacity: 0, y: reduced ? 0 : 10 }}
          transition={{ duration: spinning ? 0.07 : 0.22, ease: "easeOut" }}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

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
      <ItemRoulette item={item} />
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
              ? "A short burst of speed — keep accelerating"
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
                        : "A personal 0.6-second boost — keep accelerating"
            : "Drive through a glowing item box to collect an item")}
      </p>
    </div>
  );
}
