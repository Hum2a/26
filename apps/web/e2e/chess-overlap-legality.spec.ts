import { test, expect } from "@playwright/test";

/**
 * Browser overlap test: Two actual searches, untagged UCI bestmove,
 * chess.js validates exact FEN legality with captured generation.
 */

test.describe("Chess WASM Overlap with Legality", () => {
  test("two rapid searches: each bestmove legal for its captured FEN", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      // @ts-ignore
      const { StockfishEngine } = await import("/src/chess/stockfish-worker.ts");
      // @ts-ignore
      const { Chess } = await import("chess.js");

      type SearchRecord = {
        generation: number;
        capturedFen: string;
        move: string | null;
        isLegal: boolean;
        movingSide: string | null;
        expectedTurn: string;
      };

      const searches: SearchRecord[] = [];
      let generation = 0;

      const engine = new StockfishEngine({
        elo: 1425,
        onBestMove: (from, to, promotion) => {
          const moveUci = `${from}${to}${promotion || ""}`;
          const capturedGen = generation;
          const capturedFen = capturedGen === 1 ? fen1 : fen2;

          // Validate with chess.js
          const game = new Chess(capturedFen);
          const expectedTurn = game.turn();
          
          const moveResult = game.move({
            from,
            to,
            promotion,
          });

          searches.push({
            generation: capturedGen,
            capturedFen,
            move: moveUci,
            isLegal: !!moveResult,
            movingSide: moveResult?.color || null,
            expectedTurn,
          });
        },
      });

      await engine.initialize();

      // Search 1: Black FEN
      const fen1 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
      generation = 1;
      engine.setPosition(fen1);
      engine.go(500); // Longer search

      // Search 2: White FEN (supersedes search 1 rapidly)
      await new Promise((resolve) => setTimeout(resolve, 50));
      const fen2 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
      generation = 2;
      engine.setPosition(fen2);
      engine.go(200);

      // Wait for search 2 to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      engine.terminate();

      return {
        searches,
        fen1,
        fen2,
      };
    });

    console.log("Overlap legality result:", JSON.stringify(result, null, 2));

    // Every delivered callback must be legal for its captured FEN
    for (const search of result.searches) {
      expect(search.isLegal).toBe(true);
      expect(search.movingSide).toBe(search.expectedTurn);
    }

    // Worker isolation: gen1 should be terminated before returning
    // Only gen2 bestmove delivered (gen1 Worker terminated at 50ms, before its 500ms search completes)
    const gen1Searches = result.searches.filter((s) => s.generation === 1);
    const gen2Searches = result.searches.filter((s) => s.generation === 2);

    expect(gen1Searches.length).toBe(0); // Terminated before bestmove
    expect(gen2Searches.length).toBe(1); // Only gen2 delivered

    // Gen2 move must be legal for white FEN
    expect(gen2Searches[0].capturedFen).toBe(result.fen2);
    expect(gen2Searches[0].expectedTurn).toBe("w");
    expect(gen2Searches[0].movingSide).toBe("w");
  });
});
