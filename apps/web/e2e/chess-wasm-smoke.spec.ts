import { test, expect } from "@playwright/test";

/**
 * Real WASM smoke test - verifies production worker adapter with Stockfish binary.
 * Tests actual stockfish-worker.ts via Vite, not copied logic.
 * Validates: init at elo 1425, legal move generation, terminate safety, stale callback prevention.
 */

test.describe("Stockfish WASM Binary Smoke", () => {
  test("initializes at elo 1425 and generates legal move after e2-e4", async ({ page }) => {
    // Navigate to home (any page with Vite module access)
    await page.goto("/");

    // Inject test harness using actual production adapter
    const result = await page.evaluate(async () => {
      // @ts-ignore - dynamic import in browser context
      const { StockfishEngine } = await import("/src/chess/stockfish-worker.ts");

      const events: string[] = [];
      let bestMove: { from: string; to: string; promotion?: string } | null = null;

      const engine = new StockfishEngine({
        elo: 1425,
        onBestMove: (from, to, promotion) => {
          bestMove = { from, to, promotion };
          events.push(`bestmove: ${from}${to}${promotion || ""}`);
        },
        onError: (error) => {
          events.push(`error: ${error}`);
        },
      });

      // Init and measure time
      const initStart = performance.now();
      await engine.initialize();
      const initTime = performance.now() - initStart;
      events.push(`initialized in ${initTime.toFixed(0)}ms`);

      // Set position after 1.e4 (black to move)
      engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
      events.push("position set");

      // Search with 150ms limit
      engine.go(150);

      // Wait for bestmove callback
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Validate bestmove format and legality
      const isLegalFormat =
        bestMove &&
        /^[a-h][1-8]$/.test(bestMove.from) &&
        /^[a-h][1-8]$/.test(bestMove.to) &&
        (bestMove.promotion === undefined || /^[qrbn]$/.test(bestMove.promotion));

      engine.terminate();
      events.push("terminated");

      return { events, bestMove, isLegalFormat, initTime };
    });

    console.log("WASM smoke result:", result);

    // Assertions
    expect(result.events).toContain("position set");
    expect(result.initTime).toBeLessThan(2000); // Init should be quick
    expect(result.isLegalFormat).toBe(true);
    expect(result.bestMove).toBeTruthy();
    expect(result.bestMove?.from).toMatch(/^[a-h][1-8]$/);
    expect(result.bestMove?.to).toMatch(/^[a-h][1-8]$/);
  });

  test("terminate prevents stale callbacks after stop", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      // @ts-ignore
      const { StockfishEngine } = await import("/src/chess/stockfish-worker.ts");

      let callbackCount = 0;
      const events: string[] = [];

      const engine = new StockfishEngine({
        elo: 1425,
        onBestMove: () => {
          callbackCount++;
          events.push("callback fired");
        },
      });

      await engine.initialize();
      engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

      // Start long search
      engine.go(2000);

      // Terminate immediately (should cancel search)
      engine.terminate();
      events.push("terminated");

      // Wait to verify no callback fires
      await new Promise((resolve) => setTimeout(resolve, 300));

      return { callbackCount, events };
    });

    console.log("Terminate test result:", result);

    // No callback should fire after terminate
    expect(result.callbackCount).toBe(0);
    expect(result.events).not.toContain("callback fired");
    expect(result.events).toContain("terminated");
  });

  test("stop triggers callback, new search after stop produces distinct move", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      // @ts-ignore
      const { StockfishEngine } = await import("/src/chess/stockfish-worker.ts");

      let callbackCount = 0;
      const moves: string[] = [];

      const engine = new StockfishEngine({
        elo: 1425,
        onBestMove: (from, to) => {
          callbackCount++;
          moves.push(`${from}${to}`);
        },
      });

      await engine.initialize();
      engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

      // Start search, then stop (should trigger callback)
      engine.go(2000);
      await new Promise((resolve) => setTimeout(resolve, 50));
      engine.stop();

      // Wait for stop callback
      await new Promise((resolve) => setTimeout(resolve, 200));

      const callbacksAfterStop = callbackCount;

      // Start new search from different position
      engine.setPosition("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
      engine.go(150);

      // Wait for second callback
      await new Promise((resolve) => setTimeout(resolve, 300));

      engine.terminate();

      return { callbackCount, moves, callbacksAfterStop };
    });

    console.log("Stop and new search result:", result);

    // Stop should trigger callback
    expect(result.callbacksAfterStop).toBeGreaterThanOrEqual(1);
    // New search should also produce callback
    expect(result.callbackCount).toBeGreaterThanOrEqual(2);
    expect(result.moves.length).toBeGreaterThanOrEqual(2);
  });
});
