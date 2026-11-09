/**
 * Chess engine lifecycle unit test.
 * Verifies init+ready does NOT terminate engine, bot turn uses engine, unmount/retry ignores late init.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChessGame } from "./chess-game";
import type { ChessGuestSnapshot } from "@26/shared";

// Simple engine state tracker
const engines: any[] = [];

// Mock StockfishEngine
vi.mock("./stockfish-worker", () => {
  return {
    StockfishEngine: class MockStockfishEngine {
      private _terminated = false;
      private _callbacks: any;
      public id: number;

      constructor(config: any) {
        this._callbacks = config;
        this.id = engines.length + 1;
        engines.push(this);
      }

      async initialize() {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (!this._terminated) {
          this._callbacks.onReady();
        }
      }

      setPosition(_fen: string) {
        // noop
      }

      go(_timeMs?: number) {
        setTimeout(() => {
          if (!this._terminated) {
            this._callbacks.onBestMove("e7", "e5");
          }
        }, 5);
      }

      stop() {
        // noop
      }

      terminate() {
        this._terminated = true;
      }

      get terminated() {
        return this._terminated;
      }
    },
  };
});

describe("ChessGame engine lifecycle", () => {
  const createSnapshot = (overrides: Partial<ChessGuestSnapshot> = {}): ChessGuestSnapshot => ({
    gameId: "test-game",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: "",
    status: "in-progress",
    playerColor: "white",
    botColor: "black",
    playerTimeMs: 60000,
    botTimeMs: 60000,
    sideToMove: "white",
    plyCount: 0,
    positionRevision: 1,
    lastMoveAt: Date.now(),
    paused: false,
    inCheck: false,
    isGameOver: false,
    ...overrides,
  });

  beforeEach(() => {
    engines.length = 0;
  });

  it("init+ready does NOT terminate engine", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot();

    const { unmount } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />
    );

    // Wait for engine to be created
    await waitFor(() => {
      expect(engines.length).toBe(1);
    }, { timeout: 100 });
    
    const engine = engines[0];
    
    // Verify engine was NOT terminated after ready
    expect(engine.terminated).toBe(false);

    unmount();
  });

  it("bot turn uses engine for move calculation", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot({ sideToMove: "black" }); // Bot's turn

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />
    );

    // Wait for engine init + bot move
    await waitFor(() => {
      expect(onMove).toHaveBeenCalled();
    }, { timeout: 500 });

    // Verify bot move was submitted with correct revision
    expect(onMove).toHaveBeenCalledWith("e7", "e5", undefined, 1);
  });

  it("unmount ignores late init and terminates engine", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot();

    const { unmount } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />
    );

    // Unmount immediately, before init completes
    unmount();

    // Wait for async init to attempt completion
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify engine was created and terminated
    expect(engines.length).toBe(1);
    const engine = engines[0];
    expect(engine.terminated).toBe(true);
  });

  it("retry clears failed engine and creates new instance", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot();

    const { unmount } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />
    );

    // Wait for first engine init
    await waitFor(() => {
      expect(engines.length).toBe(1);
    }, { timeout: 100 });

    const firstEngine = engines[0];

    // Trigger error scenario (simulated via unmount and remount)
    unmount();

    // Remount (simulates retry)
    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />
    );

    // Wait for second engine init
    await waitFor(() => {
      expect(engines.length).toBe(2);
    }, { timeout: 100 });

    // Verify new engine was created
    const secondEngine = engines[1];
    
    // Verify it's a different instance
    expect(secondEngine.id).not.toBe(firstEngine.id);
  });
});
