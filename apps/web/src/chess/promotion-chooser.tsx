/**
 * Promotion chooser modal - all 4 pieces including underpromotion.
 */

import { motion, AnimatePresence } from "motion/react";
import type { ChessColor, ChessPromotionPiece } from "@26/shared";

type PromotionChooserProps = {
  color: ChessColor;
  onChoose: (piece: ChessPromotionPiece) => void;
  onCancel: () => void;
};

const pieces: Array<{ value: ChessPromotionPiece; label: string; symbol: string }> = [
  { value: "q", label: "Queen", symbol: "♕" },
  { value: "r", label: "Rook", symbol: "♖" },
  { value: "b", label: "Bishop", symbol: "♗" },
  { value: "n", label: "Knight", symbol: "♘" },
];

export function PromotionChooser({ color, onChoose, onCancel }: PromotionChooserProps) {
  const isWhite = color === "white";

  return (
    <AnimatePresence>
      <motion.div
        className="promotion-chooser-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="promotion-chooser-modal"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>Promote to:</h3>
          <div className="promotion-choices">
            {pieces.map((piece) => (
              <button
                key={piece.value}
                type="button"
                className="promotion-choice"
                onClick={() => onChoose(piece.value)}
                aria-label={`Promote to ${piece.label}`}
              >
                <span className={`piece ${isWhite ? "white" : "black"}`}>
                  {isWhite ? piece.symbol : piece.symbol.toLowerCase()}
                </span>
                <span className="piece-label">{piece.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="promotion-cancel" onClick={onCancel}>
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
