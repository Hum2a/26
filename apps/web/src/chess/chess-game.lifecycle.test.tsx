/**
 * Chess engine lifecycle unit test.
 * Verifies init+ready does NOT terminate engine, bot turn uses engine,
 * unmount ignores late init, and clicking Retry after failure reaches ready
 * without terminating/recreating the successful engine.
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChessGame } from "./chess-game";
import type { ChessGuestSnapshot, ChessPromotionPiece } from "@26/shared";

type EngineCallbacks = {
  onReady: () => void;
  onBestMove: (from: string, to: string, promotion?: ChessPromotionPiece) => void;
  onError: (error: string) => void;
};

type MockEngine = {
  id: number;
  terminated: boolean;
  initialize: () => Promise<void>;
  setPosition: (fen: string) => void;
  go: (timeMs?: number) => void;
  stop: () => void;
  terminate: () => void;
};

const { engineControl } = vi.hoisted(() => ({
  engineControl: {
    failNext: 0,
    instances: [] as MockEngine[],
  },
}));

vi.mock("./stockfish-worker", () => {
  return {
    StockfishEngine: class MockStockfishEngine {
      id: number;
      private _terminated = false;
      private _callbacks: EngineCallbacks;

      constructor(config: EngineCallbacks) {
        this._callbacks = config;
        this.id = engineControl.instances.length + 1;
        engineControl.instances.push(this);
      }

      async initialize() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (this._terminated) return;
        if (engineControl.failNext > 0) {
          engineControl.failNext -= 1;
          this._callbacks.onError("Simulated init failure");
          throw new Error("Simulated init failure");
        }
        this._callbacks.onReady();
      }

      setPosition(fen: string) {
        void fen;
      }

      go(timeMs?: number) {
        void timeMs;
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
    engineControl.failNext = 0;
    engineControl.instances.length = 0;
  });

  it("init+ready does NOT terminate engine", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot();

    const { unmount, queryByText } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(engineControl.instances.length).toBe(1);
      expect(queryByText(/Loading chess engine/i)).toBeNull();
    });

    const engine = engineControl.instances[0]!;
    expect(engine.terminated).toBe(false);

    unmount();
  });

  it("bot turn uses engine for move calculation", async () => {
    const onMove = vi.fn();
    const snapshot = createSnapshot({ sideToMove: "black" });

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(onMove).toHaveBeenCalled();
    });

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
      />,
    );

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(engineControl.instances.length).toBe(1);
    expect(engineControl.instances[0]!.terminated).toBe(true);
  });

  it("click Retry after engine failure reaches ready and bot move without terminating successful engine", async () => {
    engineControl.failNext = 1;
    const onMove = vi.fn();
    const snapshot = createSnapshot({ sideToMove: "black" });

    const { getByRole, queryByText } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(engineControl.instances.length).toBe(1);
      expect(getByRole("button", { name: /Retry loading engine/i })).toBeTruthy();
    });

    const failedEngine = engineControl.instances[0]!;
    fireEvent.click(getByRole("button", { name: /Retry loading engine/i }));

    await waitFor(() => {
      expect(engineControl.instances.length).toBe(2);
      expect(queryByText(/Loading chess engine/i)).toBeNull();
      expect(onMove).toHaveBeenCalled();
    });

    const successfulEngine = engineControl.instances[1]!;
    expect(successfulEngine.id).not.toBe(failedEngine.id);
    expect(successfulEngine.terminated).toBe(false);
    expect(engineControl.instances.length).toBe(2);
    expect(onMove).toHaveBeenCalledWith("e7", "e5", undefined, 1);
  });
});
