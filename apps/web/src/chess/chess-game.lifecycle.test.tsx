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
  const createSnapshot = (
    overrides: Partial<ChessGuestSnapshot> = {},
  ): ChessGuestSnapshot => ({
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
    capturedPoints: 0,
    score: 0,
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

  it("queues chained premoves during bot turn and executes them in order across turns", async () => {
    const onMove = vi.fn();
    // Start after 1. e4 (Black to move)
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const { getByRole, queryByRole, queryByText, rerender } = render(
      <ChessGame
        snapshot={createSnapshot({
          fen: afterE4,
          sideToMove: "black",
          plyCount: 1,
          positionRevision: 1,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // Queue premove 1: Ng1 -> f3
    fireEvent.click(getByRole("button", { name: "g1 White Knight" }));
    fireEvent.click(getByRole("button", { name: "f3" }));
    expect(queryByText(/Premove queued/i)).toBeTruthy();
    expect(getByRole("button", { name: "Cancel premove" })).toBeTruthy();

    // Queue premove 2 with the same knight from its premoved square: Nf3 -> e5
    fireEvent.click(getByRole("button", { name: "f3 White Knight" }));
    fireEvent.click(getByRole("button", { name: "e5" }));
    expect(queryByText(/2 premoves queued/i)).toBeTruthy();

    // Bot plays 1... d5 -> White's turn arrives at revision 2
    const afterD5 = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    onMove.mockClear();
    rerender(
      <ChessGame
        snapshot={createSnapshot({
          fen: afterD5,
          sideToMove: "white",
          plyCount: 2,
          positionRevision: 2,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // Premove 1 (g1 -> f3) executes immediately; Premove 2 (f3 -> e5) remains queued!
    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith("g1", "f3", undefined, 2);
    });
    expect(getByRole("button", { name: "Cancel premove" })).toBeTruthy();

    // Server confirms 2. Nf3 (revision 3, Black to move), then Black plays 2... Nc6 (revision 4, White to move)
    const afterNf3Nc6 =
      "r1bqkbnr/ppp1pppp/2n5/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    onMove.mockClear();
    rerender(
      <ChessGame
        snapshot={createSnapshot({
          fen: afterNf3Nc6,
          sideToMove: "white",
          plyCount: 4,
          positionRevision: 4,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // Premove 2 (f3 -> e5) executes immediately, emptying the queue
    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith("f3", "e5", undefined, 4);
    });
    expect(queryByRole("button", { name: "Cancel premove" })).toBeNull();
  });

  it("cancels the premove queue when the opponent's move makes the premove illegal", async () => {
    const onMove = vi.fn();
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const { getByRole, queryByRole, rerender } = render(
      <ChessGame
        snapshot={createSnapshot({
          fen: afterE4,
          sideToMove: "black",
          plyCount: 1,
          positionRevision: 1,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // White premoves e4 -> d5 hoping Black plays d7 -> d5
    fireEvent.click(getByRole("button", { name: "e4 White Pawn" }));
    fireEvent.click(getByRole("button", { name: "d5" }));
    expect(getByRole("button", { name: "Cancel premove" })).toBeTruthy();

    // Instead, Black plays 1... e5, leaving d5 empty so e4 -> d5 is illegal
    const afterE5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    onMove.mockClear();
    rerender(
      <ChessGame
        snapshot={createSnapshot({
          fen: afterE5,
          sideToMove: "white",
          plyCount: 2,
          positionRevision: 2,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // The illegal premove is discarded without calling onMove, and the pawn returns to e4
    expect(onMove).not.toHaveBeenCalled();
    expect(queryByRole("button", { name: "Cancel premove" })).toBeNull();
    expect(getByRole("button", { name: "e4 White Pawn" })).toBeTruthy();
  });

  it("auto-queens a premoved pawn promotion when the player's turn arrives", async () => {
    const onMove = vi.fn();
    const promoBlackTurn = "8/4P3/8/8/8/8/k7/4K3 b - - 0 1";
    const { getByRole, rerender } = render(
      <ChessGame
        snapshot={createSnapshot({
          fen: promoBlackTurn,
          sideToMove: "black",
          plyCount: 1,
          positionRevision: 1,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    // White premoves e7 -> e8 (auto-promotes to Queen on the virtual board without modal)
    fireEvent.click(getByRole("button", { name: "e7 White Pawn" }));
    fireEvent.click(getByRole("button", { name: "e8" }));
    expect(getByRole("button", { name: "e8 White Queen" })).toBeTruthy();

    // Black moves king a2 -> a3, making it White's turn at revision 2
    const promoWhiteTurn = "8/4P3/8/8/8/k7/8/4K3 w - - 1 2";
    onMove.mockClear();
    rerender(
      <ChessGame
        snapshot={createSnapshot({
          fen: promoWhiteTurn,
          sideToMove: "white",
          plyCount: 2,
          positionRevision: 2,
        })}
        onMove={onMove}
        onResign={vi.fn()}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith("e7", "e8", "q", 2);
    });
  });
});
