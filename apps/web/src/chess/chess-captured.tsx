import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ChessGuestSnapshot } from "@26/shared";
import { missingPieces, pieceNames, pieceSrc, type PieceColour } from "./board-model";

export function ChessCapturedScore({
  snapshot,
}: {
  snapshot: Pick<ChessGuestSnapshot, "capturedPoints" | "score" | "isGameOver">;
}) {
  const captured = `Captured: ${snapshot.capturedPoints} pts`;
  if (!snapshot.isGameOver) {
    return (
      <p className="chess-captured" role="status">
        {captured}
      </p>
    );
  }
  return (
    <p className="chess-captured" role="status">
      {captured}
      <span className="chess-captured-final">Final score: {snapshot.score} pts</span>
    </p>
  );
}

/** The pieces of one colour that have left the board, as a small row. */
export function CapturedTray({
  fen,
  colour,
  label,
}: {
  fen: string;
  colour: PieceColour;
  label: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const taken = missingPieces(fen, colour);
  const names = taken.map((kind) => pieceNames[kind]).join(", ");
  return (
    <span
      className="chess-tray"
      role="img"
      aria-label={taken.length > 0 ? `${label}: ${names}` : `${label}: nothing yet`}
    >
      <AnimatePresence initial={false}>
        {taken.map((kind, index) => (
          <motion.img
            // The nth missing piece of a kind keeps its place in the row.
            key={`${kind}-${taken.slice(0, index).filter((other) => other === kind).length}`}
            src={pieceSrc(colour, kind)}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.3, y: reduce ? 0 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 480, damping: 24 }
            }
          />
        ))}
      </AnimatePresence>
    </span>
  );
}
