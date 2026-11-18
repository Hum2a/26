import type { PlaySnapshot } from "@26/shared";
import { motion } from "motion/react";
import { useDesignMotion } from "./designs/kit";

export function QuestionImage({ question }: { question: PlaySnapshot["question"] }) {
  const image = question.image;
  const motionSet = useDesignMotion();
  if (!image) return null;
  return (
    <motion.figure
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionSet.soft}
      style={{ margin: 0 }}
    >
      <img
        src={image.src}
        alt="Picture for this question"
        width={1000}
        height={667}
        decoding="async"
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "36vh",
          objectFit: "contain",
        }}
      />
      <figcaption style={{ fontSize: "0.7em" }}>
        Photo:{" "}
        {image.creditUrl ? (
          <a href={image.creditUrl} target="_blank" rel="noreferrer">
            {image.credit}
          </a>
        ) : (
          image.credit
        )}{" "}
        · resized
      </figcaption>
    </motion.figure>
  );
}
