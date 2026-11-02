import { memo } from "react";

/**
 * Soft colour fields drawn from the theme's accent and highlight. They sit in
 * the fixed ground behind the glass so the frosted panels have something to
 * refract. They drift slowly, and stay still with reduced motion.
 */
export const LiquidGround = memo(function LiquidGround() {
  return (
    <div className="liquid-ground" aria-hidden="true">
      <span className="liquid-blob" data-blob="a" />
      <span className="liquid-blob" data-blob="b" />
      <span className="liquid-blob" data-blob="c" />
    </div>
  );
});
