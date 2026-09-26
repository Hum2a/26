import { useEffect, useState } from "react";
import { motion } from "motion/react";

const dismissMs = 4000;

export function VictimToast({
  event,
}: {
  event: { target: "self" | "other"; troller?: string } | null;
}) {
  const [open, setOpen] = useState(event?.target === "self");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = event?.target;
  const troller = event?.troller?.trim();

  useEffect(() => {
    if (target !== "self") {
      return () => undefined;
    }
    const timer = window.setTimeout(() => setOpen(false), dismissMs);
    return () => window.clearTimeout(timer);
  }, [target, troller]);

  if (!open || !event || event.target !== "self") {
    return null;
  }
  const text = troller
    ? `🎯 You've been trolled by ${troller}`
    : "🎯 You've been trolled";
  return (
    <motion.p
      role="status"
      className="rounded-2xl bg-accent px-4 py-3 text-lg font-bold text-accent-foreground"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
    >
      {text}
    </motion.p>
  );
}
