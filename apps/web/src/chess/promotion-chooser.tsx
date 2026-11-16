/**
 * Promotion chooser: the four pieces a pawn may become, drawn in the
 * player's colour. Tapping outside, or Cancel, takes the move back.
 */

import { motion, useReducedMotion } from "motion/react";
import type { ChessColor, ChessPromotionPiece } from "@26/shared";
import { pieceSrc } from "./board-model";

type PromotionChooserProps = {
  color: ChessColor;
  onChoose: (piece: ChessPromotionPiece) => void;
  onCancel: () => void;
};

const pieces: Array<{ value: ChessPromotionPiece; label: string }> = [
  { value: "q", label: "Queen" },
  { value: "r", label: "Rook" },
  { value: "b", label: "Bishop" },
  { value: "n", label: "Knight" },
];

export function PromotionChooser({ color, onChoose, onCancel }: PromotionChooserProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      className="promotion-chooser-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onCancel}
    >
      <motion.div
        className="promotion-chooser-modal"
        role="dialog"
        aria-label="Promote your pawn"
        initial={{ scale: reduce ? 1 : 0.85, opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: reduce ? 1 : 0.9, opacity: 0 }}
        transition={
          reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 26 }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Promote to</h3>
        <div className="promotion-choices">
          {pieces.map((piece, index) => (
            <motion.button
              key={piece.value}
              type="button"
              className="promotion-choice"
              onClick={() => onChoose(piece.value)}
              aria-label={`Promote to ${piece.label}`}
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: reduce ? 0 : 0.05 + index * 0.04 }}
            >
              <img
                src={pieceSrc(color === "white" ? "w" : "b", piece.value)}
                alt=""
                draggable={false}
              />
              <span className="piece-label">{piece.label}</span>
            </motion.button>
          ))}
        </div>
        <button type="button" className="promotion-cancel" onClick={onCancel}>
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}
