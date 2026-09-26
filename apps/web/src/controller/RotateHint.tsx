import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const rotateQuery = "(orientation: landscape) and (max-height: 32rem)";

export function RotateHint() {
  const [show, setShow] = useState(() => window.matchMedia(rotateQuery).matches);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const media = window.matchMedia(rotateQuery);
    function onChange() {
      setShow(media.matches);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          role="status"
          className="fixed inset-0 z-40 grid content-center justify-items-center gap-3 bg-background p-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
        >
          <p className="font-display text-4xl text-highlight">Rotate your phone</p>
          <p className="max-w-xs text-lg">The quiz is easier to play upright.</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
