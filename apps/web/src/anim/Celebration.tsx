import { memo, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * A one-shot burst in the active theme's style (confetti, petals, pixels,
 * coins, notes…), drawn by `theme/theme-identity.css` from `data-celebrate`
 * on the page. Pure CSS: eighteen
 * pieces, played once over about 1.6 seconds, then still. It never takes a
 * tap and is hidden from assistive technology. Reduced motion draws nothing.
 * Remount it (with a new key) to play it again. `muted` hides it without
 * remounting, so showing it again never replays the same burst.
 */
const pieces = Array.from({ length: 18 }, (_, index) => ({
  "--i": index,
  // Spread around a circle, with fixed variety in reach, size and timing.
  "--angle": `${(index * 360) / 18 + ((index * 23) % 17)}deg`,
  // Sideways drift for rising and falling pieces, precomputed so the CSS needs
  // no trigonometry functions that older phones lack.
  "--dx": Math.sin(
    (((index * 360) / 18 + ((index * 23) % 17)) * Math.PI) / 180,
  ).toFixed(3),
  "--reach": `${3.5 + ((index * 7) % 5) * 0.9}rem`,
  "--size": `${0.45 + ((index * 5) % 4) * 0.18}rem`,
  "--delay": `${((index * 11) % 6) * 40}ms`,
  "--spin": `${((index * 97) % 540) - 270}deg`,
})) as CSSProperties[];

export const Celebration = memo(function Celebration({
  size = "phone",
  muted = false,
}: {
  size?: "phone" | "stage";
  muted?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;
  return (
    <span
      className="celebration"
      data-size={size}
      data-muted={muted || undefined}
      aria-hidden="true"
    >
      {pieces.map((style, index) => (
        <i key={index} style={style} />
      ))}
    </span>
  );
});
