import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  chessPiecePoints,
  chessStartingBlackMaterial,
  chessTimeWinBonus,
} from "@26/shared";
import { pieceNames, pieceSrc, type PieceKind } from "./board-model";

const valued: (keyof typeof chessPiecePoints)[] = ["q", "r", "b", "n", "p"];

/** What each Black piece is worth. Always on screen, small enough not to crowd the board. */
export function PieceValues() {
  return (
    <ul className="chess-values" aria-label="Points for each Black piece you capture">
      {valued.map((kind) => (
        <li key={kind} className="chess-value">
          <img src={pieceSrc("b", kind as PieceKind)} alt="" draggable={false} />
          <span className="chess-value-name">{pieceNames[kind as PieceKind]}</span>
          <span className="chess-value-points">{chessPiecePoints[kind]}</span>
        </li>
      ))}
    </ul>
  );
}

const scoring = [
  `Capture Black pieces to bank their points as you go.`,
  `Checkmate: at least ${chessStartingBlackMaterial} pts, or your captures if higher.`,
  `Bot runs out of time: your captures + ${chessTimeWinBonus} bonus.`,
  `Lose, draw or resign: you keep what you captured.`,
];

const tips = [
  "Tap a piece, then a square — or just drag it.",
  "Premove: queue moves while Stockfish is thinking. They play the moment it is your turn.",
  "Changed your mind? Tap Cancel premove to clear the queue.",
  "Your clock turns red and beeps under 10 seconds. Turn sound on or off any time.",
  "Pawn reaches the end? Pick queen, rook, bishop or knight.",
  "Resign to bank your captures early if the position is hopeless.",
];

/**
 * How the chess round scores, plus the phone's quality-of-life features.
 * Folded by default so the board stays the main thing on screen.
 */
export function ChessGuide() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion() ?? false;
  const panelId = useId();
  return (
    <section className="chess-guide">
      <PieceValues />
      <button
        type="button"
        className="chess-tool chess-guide-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide scoring and tips" : "How to score + handy tricks"}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            className="chess-guide-panel"
            initial={{ opacity: 0, height: reduce ? "auto" : 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: reduce ? "auto" : 0 }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: [0.2, 0, 0, 1] }}
          >
            <h3>Scoring</h3>
            <ul>
              {scoring.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h3>Handy tricks</h3>
            <ul>
              {tips.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
