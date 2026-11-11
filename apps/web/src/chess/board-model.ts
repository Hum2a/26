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

export type Premove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

function readGrid(fen: string): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null),
  );
  const rows = (fen.split(" ")[0] ?? "").split("/");
  rows.forEach((text, row) => {
    if (row >= 8) return;
    let column = 0;
    for (const char of text) {
      if (char >= "1" && char <= "8") {
        column += Number(char);
        continue;
      }
      if ("kqrbnpKQRBNP".includes(char) && column < 8) {
        grid[row]![column] = char;
      }
      column += 1;
    }
  });
  return grid;
}

function writeGrid(fen: string, grid: (string | null)[][]): string {
  const placement = grid
    .map((row) => {
      let line = "";
      let empty = 0;
      for (const cell of row) {
        if (cell === null) {
          empty += 1;
        } else {
          if (empty > 0) {
            line += String(empty);
            empty = 0;
          }
          line += cell;
        }
      }
      if (empty > 0) line += String(empty);
      return line;
    })
    .join("/");
  const parts = fen.split(" ");
  parts[0] = placement;
  return parts.join(" ");
}

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

/**
 * Where the piece on `square` may premove (Chess.com geometric premove rules).
 * Pawns may step 1 or 2 (from their home rank) straight ahead or 1 square
 * diagonally ahead (even onto an empty square or friendly piece, to anticipate
 * captures, recaptures or en passant). Sliding pieces may aim anywhere along
 * their lines, knights on any L-jump, and kings 1 step or castling when their
 * rook is still on its corner. A piece may never target its own king.
 */
export function premoveTargets(fen: string, square: string): LegalTarget[] {
  const pieces = piecesInFen(fen);
  const piece = pieces.find((item) => item.square === square);
  if (!piece) return [];
  const { colour, kind } = piece;
  const { column: c0, row: r0 } = squarePlace(square);
  const bySquare = new Map(pieces.map((item) => [item.square, item]));
  const ownKing = kingSquare(pieces, colour);
  const homeRow = colour === "w" ? 7 : 0;
  const kingsideCorner = colour === "w" ? "h1" : "h8";
  const queensideCorner = colour === "w" ? "a1" : "a8";
  const hasKingsideRook =
    bySquare.get(kingsideCorner)?.kind === "r" &&
    bySquare.get(kingsideCorner)?.colour === colour;
  const hasQueensideRook =
    bySquare.get(queensideCorner)?.kind === "r" &&
    bySquare.get(queensideCorner)?.colour === colour;

  const targets: LegalTarget[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (row === r0 && column === c0) continue;
      const to = squareAt(column, row);
      if (to === ownKing) continue;
      const dc = column - c0;
      const dr = row - r0;
      const occupant = bySquare.get(to);

      if (kind === "p") {
        const dir = colour === "w" ? -1 : 1;
        const startRow = colour === "w" ? 6 : 1;
        const promoRow = colour === "w" ? 0 : 7;
        const forwardOne = dc === 0 && dr === dir;
        const forwardTwo = r0 === startRow && dc === 0 && dr === 2 * dir;
        const diagonal = Math.abs(dc) === 1 && dr === dir;
        if (!forwardOne && !forwardTwo && !diagonal) continue;
        targets.push({
          to,
          capture: diagonal,
          promotion: row === promoRow,
        });
      } else if (kind === "n") {
        if (!(
          (Math.abs(dc) === 1 && Math.abs(dr) === 2) ||
          (Math.abs(dc) === 2 && Math.abs(dr) === 1)
        )) {
          continue;
        }
        targets.push({ to, capture: occupant !== undefined, promotion: false });
      } else if (kind === "b") {
        if (Math.abs(dc) !== Math.abs(dr)) continue;
        targets.push({ to, capture: occupant !== undefined, promotion: false });
      } else if (kind === "r") {
        if (dc !== 0 && dr !== 0) continue;
        targets.push({ to, capture: occupant !== undefined, promotion: false });
      } else if (kind === "q") {
        if (dc !== 0 && dr !== 0 && Math.abs(dc) !== Math.abs(dr)) continue;
        targets.push({ to, capture: occupant !== undefined, promotion: false });
      } else if (kind === "k") {
        const step = Math.max(Math.abs(dc), Math.abs(dr)) === 1;
        const castleKingside =
          c0 === 4 &&
          r0 === homeRow &&
          dr === 0 &&
          (column === 6 || column === 7) &&
          hasKingsideRook;
        const castleQueenside =
          c0 === 4 &&
          r0 === homeRow &&
          dr === 0 &&
          (column === 2 || column === 0) &&
          hasQueensideRook;
        if (!step && !castleKingside && !castleQueenside) continue;
        targets.push({
          to,
          capture: step && occupant !== undefined,
          promotion: false,
        });
      }
    }
  }
  return targets;
}

/**
 * Validates and normalizes a requested premove on `fen` for `colour`.
 * Castling onto the corner rook square is normalized to the king's destination
 * (`g1`/`c1` or `g8`/`c8`), and a pawn reaching the back rank auto-promotes
 * to a queen unless another promotion piece is given.
 */
export function normalizePremove(
  fen: string,
  from: string,
  to: string,
  colour: PieceColour,
  promotion?: "q" | "r" | "b" | "n",
): Premove | null {
  const pieces = piecesInFen(fen);
  const piece = pieces.find((item) => item.square === from);
  if (!piece || piece.colour !== colour) return null;
  const target = premoveTargets(fen, from).find((item) => item.to === to);
  if (!target) return null;
  let finalTo = to;
  if (piece.kind === "k" && from === (colour === "w" ? "e1" : "e8")) {
    if (to === (colour === "w" ? "h1" : "h8")) {
      finalTo = colour === "w" ? "g1" : "g8";
    } else if (to === (colour === "w" ? "a1" : "a8")) {
      finalTo = colour === "w" ? "c1" : "c8";
    }
  }
  if (target.promotion) {
    return { from, to: finalTo, promotion: promotion ?? "q" };
  }
  return { from, to: finalTo, ...(promotion ? { promotion } : {}) };
}

/**
 * Applies a single premove onto a FEN's board grid so chained premoves can
 * move the same piece again or move through squares vacated by earlier premoves.
 */
export function applyPremoveToFen(
  fen: string,
  premove: Premove,
  colour: PieceColour,
): string {
  const normalized = normalizePremove(
    fen,
    premove.from,
    premove.to,
    colour,
    premove.promotion,
  );
  if (!normalized) return fen;
  const grid = readGrid(fen);
  const fromPlace = squarePlace(normalized.from);
  const toPlace = squarePlace(normalized.to);
  const char = grid[fromPlace.row]?.[fromPlace.column];
  if (!char) return fen;

  grid[fromPlace.row]![fromPlace.column] = null;

  // Castling also shifts the corner rook onto its castled square.
  const homeRow = colour === "w" ? 7 : 0;
  const rookChar = colour === "w" ? "R" : "r";
  if (
    char.toLowerCase() === "k" &&
    fromPlace.column === 4 &&
    fromPlace.row === homeRow &&
    toPlace.row === homeRow &&
    Math.abs(toPlace.column - fromPlace.column) === 2
  ) {
    if (toPlace.column === 6 && grid[homeRow]![7] === rookChar) {
      grid[homeRow]![7] = null;
      grid[homeRow]![5] = rookChar;
    } else if (toPlace.column === 2 && grid[homeRow]![0] === rookChar) {
      grid[homeRow]![0] = null;
      grid[homeRow]![3] = rookChar;
    }
  }

  // En passant capture on the current en passant target removes the passed pawn.
  const epSquare = fen.split(" ")[3];
  const enemyPawn = colour === "w" ? "p" : "P";
  if (
    char.toLowerCase() === "p" &&
    fromPlace.column !== toPlace.column &&
    grid[toPlace.row]![toPlace.column] === null &&
    epSquare === normalized.to &&
    grid[fromPlace.row]![toPlace.column] === enemyPawn
  ) {
    grid[fromPlace.row]![toPlace.column] = null;
  }

  const promoRow = colour === "w" ? 0 : 7;
  if (char.toLowerCase() === "p" && toPlace.row === promoRow) {
    const promoted = normalized.promotion ?? "q";
    grid[toPlace.row]![toPlace.column] =
      colour === "w" ? promoted.toUpperCase() : promoted;
  } else {
    grid[toPlace.row]![toPlace.column] = char;
  }

  return writeGrid(fen, grid);
}

/** Applies a queue of premoves in order onto `fen`. */
export function applyPremovesToFen(
  fen: string,
  premoves: readonly Premove[],
  colour: PieceColour,
): string {
  return premoves.reduce(
    (current, premove) => applyPremoveToFen(current, premove, colour),
    fen,
  );
}

/**
 * Checks whether a queued premove is legal in the authoritative `fen` when the
 * player's turn arrives. Returns the legal move and resulting FEN, or `null`
 * if the premove is no longer legal (e.g. piece was taken, blocked, or in check).
 */
export function resolvePremove(
  fen: string,
  premove: Premove,
  playerColor: "white" | "black",
): {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  nextFen: string;
} | null {
  const colour: PieceColour = playerColor === "white" ? "w" : "b";
  const normalized = normalizePremove(
    fen,
    premove.from,
    premove.to,
    colour,
    premove.promotion,
  );
  if (!normalized) return null;
  const pieces = piecesInFen(fen);
  const piece = pieces.find((item) => item.square === normalized.from);
  if (!piece || piece.colour !== colour) return null;
  const isPromotion =
    piece.kind === "p" &&
    ((colour === "w" && normalized.to[1] === "8") ||
      (colour === "b" && normalized.to[1] === "1"));
  const promotion = isPromotion ? (normalized.promotion ?? "q") : undefined;
  const nextFen = fenAfter(fen, normalized.from, normalized.to, promotion);
  if (!nextFen) return null;
  return {
    from: normalized.from,
    to: normalized.to,
    promotion,
    nextFen,
  };
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
  pieces: readonly Omit<BoardPiece, "id">[],
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
