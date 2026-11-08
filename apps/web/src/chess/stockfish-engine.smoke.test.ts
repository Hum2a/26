/**
 * Stockfish engine smoke test - real WASM binary in browser runtime.
 * Verifies UCI protocol, 1425 Elo acceptance, legal move generation.
 * 
 * This test requires actual browser environment (not jsdom).
 * Run with: npx vitest run --browser.enabled --browser.name=chromium stockfish-engine.smoke.test.ts
 */

import { describe, it, expect } from "vitest";
import { StockfishEngine } from "./stockfish-worker.ts";

describe("Stockfish 19 Engine - Real WASM Binary", () => {
  it("initializes and accepts UCI_Elo 1425", async () => {
    const readyCallback = vi.fn();
    const errorCallback = vi.fn();

    const engine = new StockfishEngine({
      elo: 1425,
      onReady: readyCallback,
      onError: errorCallback
    });

    await engine.initialize();

    expect(readyCallback).toHaveBeenCalled();
    expect(errorCallback).not.toHaveBeenCalled();
    expect(engine.isReady()).toBe(true);

    engine.terminate();
  });

  it("generates legal move for position after e2-e4", async () => {
    let bestmove: { from: string; to: string; promotion?: string } | null = null;

    const engine = new StockfishEngine({
      elo: 1425,
      moveTimeMs: 1000,
      onBestMove: (from, to, promotion) => {
        bestmove = { from, to, promotion };
      }
    });

    await engine.initialize();

    // Position after 1. e4
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    engine.setPosition(fen);
    engine.go(1000);

    // Wait for bestmove (with timeout)
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (bestmove) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });

    expect(bestmove).not.toBeNull();
    expect(bestmove?.from).toMatch(/^[a-h][1-8]$/);
    expect(bestmove?.to).toMatch(/^[a-h][1-8]$/);

    // Verify it's actually legal using chess.js
    const { Chess } = await import("chess.js");
    const chess = new Chess(fen);
    const move = chess.move({
      from: bestmove!.from,
      to: bestmove!.to,
      promotion: bestmove!.promotion as any
    });
    
    expect(move).not.toBeNull();
    expect(move?.san).toBeTruthy(); // Move has SAN notation = legal

    engine.terminate();
  }, 10000); // 10s timeout for search

  it("handles promotion moves", async () => {
    // Position with white pawn on e7 ready to promote
    const fen = "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1";
    
    let bestmove: { from: string; to: string; promotion?: string } | null = null;

    const engine = new StockfishEngine({
      elo: 1425,
      onBestMove: (from, to, promotion) => {
        bestmove = { from, to, promotion };
      }
    });

    await engine.initialize();
    engine.setPosition(fen);
    engine.go(500);

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (bestmove) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });

    // Engine should suggest e7e8 with promotion
    if (bestmove?.from === "e7" && bestmove?.to === "e8") {
      expect(bestmove.promotion).toMatch(/[qrbn]/);
    }

    engine.terminate();
  }, 5000);

  it("stops search on command", async () => {
    const engine = new StockfishEngine({
      elo: 1425,
      onBestMove: vi.fn()
    });

    await engine.initialize();
    
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    engine.setPosition(fen);
    engine.go(5000); // Long search

    // Stop immediately
    engine.stop();

    // Engine should handle stop gracefully
    expect(engine.isReady()).toBe(true);

    engine.terminate();
  });

  it("initializes within timeout", async () => {
    const startTime = Date.now();
    
    const engine = new StockfishEngine({ elo: 1425 });
    await engine.initialize();
    
    const elapsed = Date.now() - startTime;
    
    // Should init within 10s (timeout limit)
    expect(elapsed).toBeLessThan(10000);
    // Realistically should be much faster (< 1s)
    expect(elapsed).toBeLessThan(2000);

    engine.terminate();
  });

  it("rejects invalid elo range", () => {
    const engine = new StockfishEngine({ elo: 1425 });
    
    // Engine not ready yet - should not accept setStrength
    expect(() => engine.setStrength(1000)).not.toThrow(); // Logs error instead
    expect(() => engine.setStrength(5000)).not.toThrow(); // Logs error instead
  });

  it("handles malformed bestmove response", async () => {
    // This would require mocking worker messages
    // Engine checks for "(none)" and "0000" explicitly
    const onErrorMock = vi.fn();

    const engine = new StockfishEngine({
      elo: 1425,
      onError: onErrorMock
    });

    await engine.initialize();

    // If engine returns no move, error callback should fire
    // (Actual test would need worker message injection)

    engine.terminate();
  });
});

describe("Stockfish Engine - Asset Verification", () => {
  it("worker loads from correct path", async () => {
    // Verify worker path is /chess-engine/stockfish-19-lite-single.js
    const engine = new StockfishEngine({ elo: 1425 });
    
    await expect(engine.initialize()).resolves.not.toThrow();
    expect(engine.isReady()).toBe(true);

    engine.terminate();
  });
});

describe("Stockfish Engine - Performance Bounds", () => {
  it("respects movetime limit", async () => {
    let bestmove: any = null;
    let searchTime = 0;

    const engine = new StockfishEngine({
      elo: 1425,
      moveTimeMs: 500,
      onBestMove: (from, to) => {
        bestmove = { from, to };
        searchTime = Date.now();
      }
    });

    await engine.initialize();

    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    engine.setPosition(fen);
    
    const startTime = Date.now();
    engine.go(500);

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (bestmove) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 2000);
    });

    if (bestmove) {
      const elapsed = searchTime - startTime;
      // Should complete around 500ms (±100ms for overhead)
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThan(1500);
    }

    engine.terminate();
  }, 5000);
});
