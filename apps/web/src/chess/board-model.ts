import { Chess, type Square } from "chess.js";

/**
 * What the board draws, worked out from the room's FEN. Pure: no DOM, no
 * clock. The room stays the authority on every move; this only decides how
 * the position it sent is shown (which piece slid where, what was taken).
 */

export type PieceColour = "w" | "b";
export type PieceKind = "k" | "q" | "r" | "b" | "n" | "p";

export type BoardPiece = {
  /** Stable across positions, so a moved piece slides instead of popping. */
  id: string;
  colour: PieceColour;
  kind: PieceKind;
  square: string;
};

export type BoardChange = {
  pieces: BoardPiece[];
  /** Pieces that left the board in this change, drawn fading on their square. */
  taken: BoardPiece[];
  /** The move that produced this position, when one can be told from the diff. */
  move: { from: string; to: string } | null;
  kind: "none" | "move" | "capture" | "castle" | "promote";
};

const files = "abcdefgh";

export function squareAt(column: number, row: number): string {
  return `${files[column]}${8 - row}`;
}

/** Column and row (0 at the top-left from White's side) of a square. */
export function squarePlace(square: string): { column: number; row: number } {
  return {
    column: square.charCodeAt(0) - 97,
    row: 8 - Number(square[1]),
  };
}

/** Every piece in a FEN, without ids. Unknown characters are ignored. */
export function piecesInFen(fen: string): Omit<BoardPiece, "id">[] {
  const rows = (fen.split(" ")[0] ?? "").split("/");
  const found: Omit<BoardPiece, "id">[] = [];
  rows.forEach((text, row) => {
    let column = 0;
    for (const char of text) {
      if (char >= "1" && char <= "8") {
        column += Number(char);
        continue;
      }
      const kind = char.toLowerCase();
      if ("kqrbnp".includes(kind) && column < 8 && row < 8) {
        found.push({
          colour: char === kind ? "b" : "w",
          kind: kind as PieceKind,
          square: squareAt(column, row),
        });
      }
      column += 1;
    }
  });
  return found;
}

function distance(a: string, b: string): number {
  const from = squarePlace(a);
  const to = squarePlace(b);
  return Math.abs(from.column - to.column) + Math.abs(from.row - to.row);
}

let nextId = 0;
function freshId(piece: Omit<BoardPiece, "id">): string {
  nextId += 1;
  return `${piece.colour}${piece.kind}-${nextId}`;
}

/**
 * Carries piece identities from the last position to the next one.
 * Pieces that did not move keep their id; a piece that appears on a new
 * square takes the id of the nearest vanished piece of its own kind (a move),
 * or of a vanished pawn of its colour (a promotion). Whatever is left over
 * was taken.
 */
export function reconcileBoard(
  previous: readonly BoardPiece[] | null,
  fen: string,
): BoardChange {
  const next = piecesInFen(fen);
  if (!previous) {
    return {
      pieces: next.map((piece) => ({ ...piece, id: freshId(piece) })),
      taken: [],
      move: null,
      kind: "none",
    };
  }
  const left = [...previous];
  const placed: (BoardPiece | null)[] = next.map((piece) => {
    const index = left.findIndex(
      (old) =>
        old.square === piece.square &&
        old.kind === piece.kind &&
        old.colour === piece.colour,
    );
    if (index < 0) return null;
    const [same] = left.splice(index, 1);
    return same!;
  });
  const moves: { from: string; to: string; piece: BoardPiece }[] = [];
  let promoted = false;
  next.forEach((piece, at) => {
    if (placed[at]) return;
    const candidates = left
      .filter((old) => old.colour === piece.colour && old.kind === piece.kind)
      .sort(
        (a, b) => distance(a.square, piece.square) - distance(b.square, piece.square),
      );
    let source = candidates[0];
    if (!source) {
      source = left
        .filter((old) => old.colour === piece.colour && old.kind === "p")
        .sort(
          (a, b) => distance(a.square, piece.square) - distance(b.square, piece.square),
        )[0];
      if (source) promoted = true;
    }
    if (source) {
      left.splice(left.indexOf(source), 1);
      const moved = { ...piece, id: source.id };
      placed[at] = moved;
      moves.push({ from: source.square, to: piece.square, piece: moved });
    } else {
      placed[at] = { ...piece, id: freshId(piece) };
    }
  });
  const pieces = placed as BoardPiece[];
  // A castle moves a king and a rook: the king's journey is "the move".
  const lead = moves.find((move) => move.piece.kind === "k") ?? moves[0] ?? null;
  const kind: BoardChange["kind"] =
    moves.length === 0
      ? "none"
      : promoted
        ? "promote"
        : moves.length === 2 &&
            moves.every((move) => move.piece.colour === lead!.piece.colour)
          ? "castle"
          : left.length > 0
            ? "capture"
            : "move";
  return {
    pieces,
    taken: moves.length > 0 ? left : [],
    move: lead ? { from: lead.from, to: lead.to } : null,
    kind,
  };
}

export type LegalTarget = { to: string; capture: boolean; promotion: boolean };

/**
 * Where the piece on `square` may go. A hint for the player only: the room
 * validates every move again. `null` means the position could not be read,
 * and the board then lets any target through to the room.
 */
export function legalTargets(fen: string, square: string): LegalTarget[] | null {
  try {
    const moves = new Chess(fen).moves({ square: square as Square, verbose: true });
    const seen = new Map<string, LegalTarget>();
    for (const move of moves) {
      seen.set(move.to, {
        to: move.to,
        capture: move.isCapture() || move.isEnPassant(),
        promotion: move.isPromotion(),
      });
    }
    return [...seen.values()];
  } catch {
    return null;
  }
}

/** The position after a move, for showing a move while the room confirms it. */
export function fenAfter(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): string | null {
  try {
    const game = new Chess(fen);
    game.move({ from, to, promotion });
    return game.fen();
  } catch {
    return null;
  }
}

export function kingSquare(
  pieces: readonly BoardPiece[],
  colour: PieceColour,
): string | null {
  return (
    pieces.find((piece) => piece.kind === "k" && piece.colour === colour)?.square ??
    null
  );
}

const startCounts: Record<PieceKind, number> = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
const trayOrder: PieceKind[] = ["q", "r", "b", "n", "p"];

/**
 * The pieces of one colour missing from the board, biggest first, for the
 * captured tray. A promotion can make the count briefly generous; it never
 * goes below zero.
 */
export function missingPieces(fen: string, colour: PieceColour): PieceKind[] {
  const present = piecesInFen(fen).filter((piece) => piece.colour === colour);
  const missing: PieceKind[] = [];
  for (const kind of trayOrder) {
    const have = present.filter((piece) => piece.kind === kind).length;
    for (let count = have; count < startCounts[kind]; count += 1) missing.push(kind);
  }
  return missing;
}

export const pieceNames: Record<PieceKind, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

export function pieceSrc(colour: PieceColour, kind: PieceKind): string {
  return `/assets/chess/pieces/${colour}${kind.toUpperCase()}.svg`;
}
