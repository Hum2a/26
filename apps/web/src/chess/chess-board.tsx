/**
 * The chess board: carved pieces on a wooden board. Pieces slide between
 * squares, a taken piece shrinks away, and the player moves by tapping two
 * squares or by dragging. The room decides every move; this only draws the
 * position it is given and reports the move the player asks for.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { ChessColor } from "@26/shared";
import {
  kingSquare,
  legalTargets,
  pieceNames,
  pieceSrc,
  reconcileBoard,
  squareAt,
  squarePlace,
  type BoardChange,
  type BoardPiece,
} from "./board-model";

export type ChessBoardProps = {
  /** The position to draw (the room's, or the player's move awaiting the room). */
  fen: string;
  playerColor: ChessColor;
  /** The side to move is in check. */
  inCheck: boolean;
  sideToMove: ChessColor;
  /** The player may move now. */
  interactive: boolean;
  /** The drawn position includes a move the room has not confirmed yet. */
  sending?: boolean;
  onMove: (from: string, to: string) => void;
  /** The drawn position changed: a move, capture, castle or promotion landed. */
  onChange?: (change: BoardChange) => void;
  /** The player touched the board (used to unlock sound). */
  onTouch?: () => void;
};

const indexes = [0, 1, 2, 3, 4, 5, 6, 7];

export function ChessBoard({
  fen,
  playerColor,
  inCheck,
  sideToMove,
  interactive,
  sending = false,
  onMove,
  onChange,
  onTouch,
}: ChessBoardProps) {
  const reduce = useReducedMotion() ?? false;
  const flipped = playerColor === "black";
  const own = playerColor === "white" ? "w" : "b";
  const boardRef = useRef<HTMLDivElement>(null);

  // Piece identities carry over from one position to the next (derived state).
  const [shown, setShown] = useState(() => ({
    fen,
    change: reconcileBoard(null, fen),
  }));
  if (shown.fen !== fen) {
    setShown({ fen, change: reconcileBoard(shown.change.pieces, fen) });
  }
  const { pieces, move } = shown.change;

  useEffect(() => {
    if (shown.change.kind !== "none") onChange?.(shown.change);
    // Only a new position is news; a new callback identity is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const [selected, setSelected] = useState<string | null>(null);
  // A piece just dropped on its square should not also slide there.
  const [dropped, setDropped] = useState<string | null>(null);
  if (
    selected &&
    (!interactive || !pieces.some((piece) => piece.square === selected))
  ) {
    setSelected(null);
  }
  useEffect(() => {
    if (!dropped) return;
    const timer = window.setTimeout(() => setDropped(null), 250);
    return () => window.clearTimeout(timer);
  }, [dropped]);

  const targets = useMemo(
    () => (selected ? legalTargets(fen, selected) : []),
    [fen, selected],
  );
  const bySquare = useMemo(
    () => new Map(pieces.map((piece) => [piece.square, piece])),
    [pieces],
  );
  const checked = inCheck
    ? kingSquare(pieces, sideToMove === "white" ? "w" : "b")
    : null;

  /** A legal target, or any square when the position could not be read. */
  function mayGo(from: string, to: string): boolean {
    const list = from === selected ? targets : legalTargets(fen, from);
    return list === null || list.some((target) => target.to === to);
  }

  function press(square: string) {
    onTouch?.();
    if (!interactive) return;
    const piece = bySquare.get(square);
    if (selected && selected !== square && mayGo(selected, square)) {
      setSelected(null);
      onMove(selected, square);
      return;
    }
    setSelected(piece?.colour === own && selected !== square ? square : null);
  }

  /** The square under a point on the page, allowing for a flipped board. */
  function squareUnder(x: number, y: number): string | null {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const column = Math.floor(((x - box.left) / box.width) * 8);
    const row = Math.floor(((y - box.top) / box.height) * 8);
    if (column < 0 || column > 7 || row < 0 || row > 7) return null;
    return flipped ? squareAt(7 - column, 7 - row) : squareAt(column, row);
  }

  function drop(piece: BoardPiece, x: number, y: number): boolean {
    const to = squareUnder(x, y);
    if (!interactive || !to || to === piece.square || !mayGo(piece.square, to)) {
      return false;
    }
    setDropped(piece.id);
    setSelected(null);
    onMove(piece.square, to);
    return true;
  }

  return (
    <div
      className="chess-board"
      ref={boardRef}
      data-sending={sending || undefined}
      data-interactive={interactive || undefined}
    >
      <div className="chess-squares" role="group" aria-label="Chess board">
        {indexes.map((row) =>
          indexes.map((column) => {
            const square = flipped
              ? squareAt(7 - column, 7 - row)
              : squareAt(column, row);
            const place = squarePlace(square);
            const piece = bySquare.get(square);
            const target =
              targets === null ? undefined : targets.find((item) => item.to === square);
            const label = piece
              ? `${square} ${piece.colour === "w" ? "White" : "Black"} ${capital(pieceNames[piece.kind])}`
              : square;
            return (
              <button
                key={square}
                type="button"
                className="chess-square"
                data-shade={(place.column + place.row) % 2 === 0 ? "light" : "dark"}
                data-selected={selected === square || undefined}
                data-last={
                  move && (move.from === square || move.to === square) ? "" : undefined
                }
                data-target={target ? (target.capture ? "capture" : "move") : undefined}
                data-check={checked === square || undefined}
                aria-label={label}
                aria-pressed={selected === square}
                onClick={() => press(square)}
              >
                {column === 0 ? (
                  <span
                    className="chess-coordinate"
                    data-edge="rank"
                    aria-hidden="true"
                  >
                    {square[1]}
                  </span>
                ) : null}
                {row === 7 ? (
                  <span
                    className="chess-coordinate"
                    data-edge="file"
                    aria-hidden="true"
                  >
                    {square[0]}
                  </span>
                ) : null}
                <span className="chess-mark" aria-hidden="true" />
              </button>
            );
          }),
        )}
      </div>
      <div className="chess-pieces" aria-hidden="true">
        <AnimatePresence initial={false}>
          {pieces.map((piece) => (
            <Piece
              key={piece.id}
              piece={piece}
              flipped={flipped}
              reduce={reduce}
              movable={interactive && piece.colour === own}
              lifted={selected === piece.square}
              instant={dropped === piece.id}
              onPress={press}
              onGrab={(square) => {
                onTouch?.();
                setSelected(square);
              }}
              onDrop={drop}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Piece({
  piece,
  flipped,
  reduce,
  movable,
  lifted,
  instant,
  onPress,
  onGrab,
  onDrop,
}: {
  piece: BoardPiece;
  flipped: boolean;
  reduce: boolean;
  movable: boolean;
  lifted: boolean;
  instant: boolean;
  onPress: (square: string) => void;
  onGrab: (square: string) => void;
  onDrop: (piece: BoardPiece, x: number, y: number) => boolean;
}) {
  const place = squarePlace(piece.square);
  const column = flipped ? 7 - place.column : place.column;
  const row = flipped ? 7 - place.row : place.row;
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  return (
    <motion.div
      className="chess-piece"
      data-movable={movable || undefined}
      initial={{ opacity: 0, scale: 0.6, x: `${column * 100}%`, y: `${row * 100}%` }}
      animate={{ opacity: 1, scale: 1, x: `${column * 100}%`, y: `${row * 100}%` }}
      exit={{ opacity: 0, scale: reduce ? 1 : 0.3 }}
      transition={
        instant
          ? { duration: 0 }
          : reduce
            ? { duration: 0.15 }
            : {
                x: { type: "spring", stiffness: 520, damping: 38 },
                y: { type: "spring", stiffness: 520, damping: 38 },
                default: { duration: 0.22, ease: "easeOut" },
              }
      }
    >
      <motion.img
        src={pieceSrc(piece.colour, piece.kind)}
        alt=""
        draggable={false}
        decoding="async"
        style={{ x: dragX, y: dragY }}
        animate={{ scale: lifted && !reduce ? 1.14 : 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 26 }}
        drag={movable}
        dragMomentum={false}
        dragElastic={0}
        whileDrag={{ scale: 1.25, zIndex: 5 }}
        onTap={movable ? () => onPress(piece.square) : undefined}
        onDragStart={() => onGrab(piece.square)}
        onDragEnd={(_, info) => {
          // Motion reports page coordinates; the board is measured in the viewport.
          const moved = onDrop(
            piece,
            info.point.x - window.scrollX,
            info.point.y - window.scrollY,
          );
          if (moved || reduce) {
            dragX.set(0);
            dragY.set(0);
            return;
          }
          void animate(dragX, 0, { type: "spring", stiffness: 420, damping: 30 });
          void animate(dragY, 0, { type: "spring", stiffness: 420, damping: 30 });
        }}
      />
    </motion.div>
  );
}

function capital(text: string): string {
  return text[0]!.toUpperCase() + text.slice(1);
}
