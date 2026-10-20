import { useState } from "react";
import { motion } from "motion/react";
import "./question-option-image.css";

/** Decorative illustration: the option's existing text remains its accessible name.
 * Absolute positioning reserves no extra space and never changes a card's size. */
export function QuestionOptionImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.img
      className="question-option-image"
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
    />
  );
}
