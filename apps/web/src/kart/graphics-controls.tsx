import { useId } from "react";
import { motion } from "motion/react";
import type { GraphicsMode } from "./graphics";
import type { useKartGraphics } from "./graphics-preferences";
import "./graphics.css";

export function GraphicsControls({
  mode,
  tier,
  health,
  onMode,
  compact = false,
}: ReturnType<typeof useKartGraphics> & { compact?: boolean }) {
  const id = useId();
  return (
    <section className="kart-graphics" aria-label="Kart graphics">
      <label htmlFor={id}>Graphics</label>
      <select
        id={id}
        value={mode}
        onChange={(event) => onMode(event.target.value as GraphicsMode)}
      >
        <option value="auto">Auto</option>
        <option value="high">High</option>
        <option value="low">Low</option>
      </select>
      <motion.p
        className={compact ? "sr-only" : undefined}
        key={`${tier}:${health}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        role="status"
      >
        {tier === "balanced"
          ? "Balanced"
          : tier === "low"
            ? "Low detail"
            : "High detail"}
        {mode === "auto" ? " · automatic" : " · your choice"}.
        {health === "strained"
          ? " Slow frames detected in this view."
          : health === "smooth"
            ? " This view is running smoothly."
            : " Checking performance as you drive."}
      </motion.p>
    </section>
  );
}
