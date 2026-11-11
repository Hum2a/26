import { describe, expect, it } from "vitest";
import {
  applyPremovesToFen,
  applyPremoveToFen,
  fenAfter,
  legalTargets,
  missingPieces,
  normalizePremove,
  piecesInFen,
  premoveTargets,
  reconcileBoard,
  resolvePremove,
} from "./board-model";

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("board model", () => {
  it("reads every piece from a FEN", () => {
    const pieces = piecesInFen(start);
    expect(pieces).toHaveLength(32);
    expect(pieces.find((piece) => piece.square === "e1")).toMatchObject({
      colour: "w",
      kind: "k",
    });
    expect(pieces.find((piece) => piece.square === "d8")).toMatchObject({
      colour: "b",
      kind: "q",
    });
  });

  it("keeps a moved piece's identity so it slides, and names the move", () => {
    const before = reconcileBoard(null, start);
    const pawn = before.pieces.find((piece) => piece.square === "e2")!;
    const after = reconcileBoard(before.pieces, fenAfter(start, "e2", "e4")!);
    expect(after.kind).toBe("move");
    expect(after.move).toEqual({ from: "e2", to: "e4" });
    expect(after.pieces.find((piece) => piece.square === "e4")?.id).toBe(pawn.id);
    expect(after.taken).toEqual([]);
    // Nothing else changed identity.
    const unchanged = after.pieces.filter((piece) => piece.square !== "e4");
    expect(
      unchanged.every((piece) => before.pieces.some((old) => old.id === piece.id)),
    ).toBe(true);
  });

  it("reports a capture and the piece that left", () => {
    const fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    const before = reconcileBoard(null, fen);
    const after = reconcileBoard(before.pieces, fenAfter(fen, "e4", "d5")!);
    expect(after.kind).toBe("capture");
    expect(after.move).toEqual({ from: "e4", to: "d5" });
    expect(after.taken).toHaveLength(1);
    expect(after.taken[0]).toMatchObject({ colour: "b", kind: "p", square: "d5" });
  });

  it("treats castling as one move led by the king", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const before = reconcileBoard(null, fen);
    const after = reconcileBoard(before.pieces, fenAfter(fen, "e1", "g1")!);
    expect(after.kind).toBe("castle");
    expect(after.move).toEqual({ from: "e1", to: "g1" });
    expect(after.pieces.find((piece) => piece.square === "f1")?.kind).toBe("r");
  });

  it("carries a pawn's identity into the piece it promotes to", () => {
    const fen = "8/4P3/8/8/8/8/k7/4K3 w - - 0 1";
    const before = reconcileBoard(null, fen);
    const pawn = before.pieces.find((piece) => piece.kind === "p")!;
    const after = reconcileBoard(before.pieces, fenAfter(fen, "e7", "e8", "q")!);
    expect(after.kind).toBe("promote");
    expect(after.pieces.find((piece) => piece.square === "e8")).toMatchObject({
      id: pawn.id,
      kind: "q",
    });
  });

  it("lists legal targets, marking captures and promotions", () => {
    const opening = legalTargets(start, "e2")!;
    expect(opening.map((target) => target.to).sort()).toEqual(["e3", "e4"]);
    expect(legalTargets(start, "e1")).toEqual([]);
    const taking = legalTargets(
      "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2",
      "e4",
    )!;
    expect(taking.find((target) => target.to === "d5")?.capture).toBe(true);
    expect(taking.find((target) => target.to === "e5")?.capture).toBe(false);
    const promoting = legalTargets("8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e7")!;
    expect(promoting).toEqual([{ to: "e8", capture: false, promotion: true }]);
  });

  it("returns null for a position it cannot read, and no position for an illegal move", () => {
    expect(legalTargets("not a fen", "e2")).toBeNull();
    expect(fenAfter(start, "e2", "e5")).toBeNull();
  });

  it("counts the pieces missing from the board for the tray", () => {
    expect(missingPieces(start, "b")).toEqual([]);
    expect(missingPieces("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "b")).toHaveLength(15);
    expect(
      missingPieces("rnb1kbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "b"),
    ).toEqual(["q", "p"]);
  });

  it("computes Chess.com geometric premove targets including pawn diagonals, recaptures, and castling", () => {
    // A pawn on its home rank can premove 1 or 2 forward, plus both forward diagonals even when empty.
    const pawnTargets = premoveTargets(start, "e2");
    expect(pawnTargets.map((item) => item.to).sort()).toEqual(["d3", "e3", "e4", "f3"]);
    expect(pawnTargets.find((item) => item.to === "d3")?.capture).toBe(true);
    expect(pawnTargets.find((item) => item.to === "e4")?.capture).toBe(false);

    // A sliding piece can premove through pieces and onto friendly pieces (for recaptures), but never onto its own king.
    const queenTargets = premoveTargets(start, "d1").map((item) => item.to);
    expect(queenTargets).toContain("d8");
    expect(queenTargets).toContain("h5");
    expect(queenTargets).toContain("d2"); // friendly recapture target
    expect(queenTargets).not.toContain("e1"); // never own king

    // A king on its home square can premove 1 step or castle (two squares or onto its corner rook).
    const kingTargets = premoveTargets(start, "e1").map((item) => item.to);
    expect(kingTargets).toContain("e2");
    expect(kingTargets).toContain("g1");
    expect(kingTargets).toContain("h1");
    expect(kingTargets).toContain("c1");
    expect(kingTargets).toContain("a1");
  });

  it("chains premoves on the virtual board, including castling and auto-queen promotion", () => {
    // Chain 1: move knight g1->f3, bishop f1->c4, castle e1->h1 (normalized to g1), then move castled rook f1->e1
    const afterChain = applyPremovesToFen(
      start,
      [
        { from: "g1", to: "f3" },
        { from: "f1", to: "c4" },
        { from: "e1", to: "h1" },
        { from: "f1", to: "e1" },
      ],
      "w",
    );
    const pieces = piecesInFen(afterChain);
    expect(pieces.find((p) => p.square === "f3")).toMatchObject({
      colour: "w",
      kind: "n",
    });
    expect(pieces.find((p) => p.square === "c4")).toMatchObject({
      colour: "w",
      kind: "b",
    });
    expect(pieces.find((p) => p.square === "g1")).toMatchObject({
      colour: "w",
      kind: "k",
    });
    expect(pieces.find((p) => p.square === "e1")).toMatchObject({
      colour: "w",
      kind: "r",
    });

    // Chain 2: pawn promotes to queen on e8, then premoves as a queen from e8 to a8
    const promoStart = "8/4P3/8/8/8/8/k7/4K3 b - - 0 1";
    const norm = normalizePremove(promoStart, "e7", "e8", "w");
    expect(norm).toEqual({ from: "e7", to: "e8", promotion: "q" });
    const afterPromo = applyPremoveToFen(promoStart, norm!, "w");
    expect(piecesInFen(afterPromo).find((p) => p.square === "e8")).toMatchObject({
      colour: "w",
      kind: "q",
    });
    const afterQueenSlide = applyPremoveToFen(
      afterPromo,
      { from: "e8", to: "a8" },
      "w",
    );
    expect(piecesInFen(afterQueenSlide).find((p) => p.square === "a8")).toMatchObject({
      colour: "w",
      kind: "q",
    });
  });

  it("resolves a premove when legal on the new board and rejects it when illegal", () => {
    const afterE4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    expect(resolvePremove(afterE4E5, { from: "g1", to: "f3" }, "white")).toMatchObject({
      from: "g1",
      to: "f3",
      promotion: undefined,
    });

    // Diagonal pawn premove e4->d5 is rejected when d5 is still empty
    expect(resolvePremove(afterE4E5, { from: "e4", to: "d5" }, "white")).toBeNull();

    // Diagonal pawn premove e4->d5 succeeds when Black actually played d7->d5
    const afterE4D5 = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    expect(resolvePremove(afterE4D5, { from: "e4", to: "d5" }, "white")).toMatchObject({
      from: "e4",
      to: "d5",
    });

    // Premove is rejected when the player was put in check and the premove does not answer check
    const inCheckFen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(resolvePremove(inCheckFen, { from: "b1", to: "c3" }, "white")).toBeNull();
  });
});
