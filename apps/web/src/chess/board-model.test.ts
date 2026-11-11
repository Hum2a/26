import { describe, expect, it } from "vitest";
import {
  fenAfter,
  legalTargets,
  missingPieces,
  piecesInFen,
  reconcileBoard,
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
});
