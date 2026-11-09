import { describe, it, expect } from "vitest";

/**
 * Deterministic mock test for search generation barrier.
 * MUST FAIL if stale callback from searchA delivered as searchB result.
 */

type BestMoveCallback = (from: string, to: string, promotion?: string) => void;

class MockStockfishEngine {
  private searchGeneration = 0;
  private expectedBestmoveGeneration: number | null = null;
  private onBestMove: BestMoveCallback;

  constructor(onBestMove: BestMoveCallback) {
    this.onBestMove = onBestMove;
  }

  go(): number {
    this.searchGeneration++;
    const thisSearchGeneration = this.searchGeneration;
    
    // New search expects bestmove with THIS generation
    // Old expectedBestmoveGeneration is now invalid
    this.expectedBestmoveGeneration = thisSearchGeneration;
    
    return thisSearchGeneration;
  }

  // Simulate receiving bestmove from engine with its generation tag
  // (In real UCI, generation is tracked via which go() command was sent)
  simulateBestmove(from: string, to: string, belongsToGeneration: number): void {
    // Only accept if bestmove matches currently expected generation
    if (this.expectedBestmoveGeneration !== belongsToGeneration) {
      // Stale bestmove from old search - IGNORE
      return;
    }

    // Clear so duplicate ignored
    this.expectedBestmoveGeneration = null;
    this.onBestMove(from, to);
  }
}

describe("Stockfish search generation barrier", () => {
  it("MUST reject stale searchA bestmove delivered after searchB started", () => {
    const receivedMoves: Array<{ search: string; move: string }> = [];

    const engine = new MockStockfishEngine((from, to) => {
      receivedMoves.push({ search: "unknown", move: `${from}${to}` });
    });

    // Start searchA (gen=1)
    const genA = engine.go();
    expect(genA).toBe(1);

    // Start searchB BEFORE searchA returns (gen=2)
    const genB = engine.go();
    expect(genB).toBe(2);

    // Late bestmove from searchA arrives (tagged with gen=1)
    engine.simulateBestmove("c7", "c5", genA); // Should be IGNORED (expected is genB)

    // Genuine bestmove from searchB arrives (tagged with gen=2)
    engine.simulateBestmove("g1", "f3", genB); // Should be ACCEPTED

    // ASSERT: Only g1f3 delivered, c7c5 NEVER treated as searchB result
    expect(receivedMoves.length).toBe(1);
    expect(receivedMoves[0].move).toBe("g1f3");
  });

  it("accepts searchA bestmove when no superseding search", () => {
    const receivedMoves: string[] = [];

    const engine = new MockStockfishEngine((from, to) => {
      receivedMoves.push(`${from}${to}`);
    });

    const gen = engine.go();
    engine.simulateBestmove("c7", "c5", gen);

    expect(receivedMoves).toEqual(["c7c5"]);
  });

  it("rejects duplicate bestmove from same search", () => {
    const receivedMoves: string[] = [];

    const engine = new MockStockfishEngine((from, to) => {
      receivedMoves.push(`${from}${to}`);
    });

    const gen = engine.go();
    engine.simulateBestmove("c7", "c5", gen); // First - accepted (expectedGen cleared)
    engine.simulateBestmove("e7", "e5", gen); // Duplicate - ignored (expectedGen now null)

    expect(receivedMoves).toEqual(["c7c5"]);
  });
});
