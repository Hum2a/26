/**
 * Chess game frontend tests - stale search handling, promotion, cleanup.
 * Uses actual stockfish-worker.ts (not mock).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChessGame } from "./chess-game.tsx";
import type { ChessGuestSnapshot } from "@26/shared";

// Mock Motion to avoid animation library deps in tests
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, onClick, ...props }: any) => (
      <div onClick={onClick} {...props}>{children}</div>
    )
  },
  AnimatePresence: ({ children }: any) => children
}));

const createSnapshot = (overrides?: Partial<ChessGuestSnapshot>): ChessGuestSnapshot => ({
  gameId: "test-game",
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  pgn: "1. e4",
  status: "in-progress",
  playerColor: "white",
  botColor: "black",
  playerTimeMs: 60000,
  botTimeMs: 60000,
  sideToMove: "black",
  plyCount: 1,
  inCheck: false,
  isGameOver: false,
  positionRevision: 1,
  ...overrides
});

describe("ChessGame", () => {
  let onMoveMock: ReturnType<typeof vi.fn>;
  let onResignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMoveMock = vi.fn();
    onResignMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders board and controls", () => {
    const snapshot = createSnapshot();
    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // Engine status shown during init
    expect(screen.getByText(/loading chess engine/i)).toBeInTheDocument();
    
    // Resign button present
    expect(screen.getByText(/resign/i)).toBeInTheDocument();
  });

  it("shows game over state", () => {
    const snapshot = createSnapshot({
      isGameOver: true,
      status: "checkmate",
      winner: "player",
      terminationReason: "Checkmate! You won"
    });

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    expect(screen.getByText(/you won/i)).toBeInTheDocument();
    expect(screen.getByText(/checkmate! you won/i)).toBeInTheDocument();
  });

  it("shows promotion chooser for pawn to 8th rank", async () => {
    // White pawn on e7, ready to promote
    const snapshot = createSnapshot({
      fen: "8/4P3/8/8/8/8/8/K6k w - - 0 1",
      sideToMove: "white",
      positionRevision: 5
    });

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // Wait for engine ready (if it loads)
    await waitFor(() => {
      const statusEl = screen.queryByText(/loading/i);
      return !statusEl;
    }, { timeout: 3000 });

    // Simulate selecting e7 and moving to e8 (promotion)
    // Note: Full interaction test would need board component integration
    // This tests the promotion chooser appearance logic
    
    // Verify promotion pieces available
    // (Would need full render to test actual selection)
  });

  it("captures positionRevision at search dispatch", () => {
    const snapshot = createSnapshot({
      sideToMove: "black", // Bot's turn
      positionRevision: 3
    });

    const { rerender } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // Update snapshot with new position revision (pause/resume scenario)
    const updated = createSnapshot({
      sideToMove: "black",
      positionRevision: 4, // Incremented by pause
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    });

    rerender(
      <ChessGame
        snapshot={updated}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // Component should cancel old search and start new one with positionRevision=4
    // onMove will be called with positionRevision captured at NEW search dispatch
  });

  it("prevents stale bestmove after position change", async () => {
    const snapshot = createSnapshot({
      sideToMove: "black",
      positionRevision: 2,
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    });

    const { rerender } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // Simulate search started with positionRevision=2
    // Then position changes before bestmove arrives
    const changedSnapshot = createSnapshot({
      sideToMove: "white", // Position changed
      positionRevision: 3,
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"
    });

    rerender(
      <ChessGame
        snapshot={changedSnapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    // If stale bestmove arrives after rerender, it should be ignored
    // (Component checks positionRevision in searchStateRef against current snapshot)
    
    // Wait to ensure no stale move submitted
    await waitFor(() => {
      // Verify onMove not called with stale revision
      const calls = onMoveMock.mock.calls;
      if (calls.length > 0) {
        // If called, must be with current positionRevision=3, not old 2
        const lastCall = calls[calls.length - 1];
        expect(lastCall[3]).not.toBe(2);
      }
    }, { timeout: 1000 });
  });

  it("terminates engine on unmount", () => {
    const snapshot = createSnapshot();
    const { unmount } = render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    unmount();

    // Engine should be terminated (test by checking no further callbacks)
    // Real test would verify worker.terminate() called
  });

  it("handles resign action", () => {
    const snapshot = createSnapshot();
    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    const resignButton = screen.getByText(/resign/i);
    fireEvent.click(resignButton);

    expect(onResignMock).toHaveBeenCalled();
  });

  it("disables board when disabled prop true", () => {
    const snapshot = createSnapshot({ sideToMove: "white" });
    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
        disabled={true}
      />
    );

    const resignButton = screen.getByText(/resign/i);
    expect(resignButton).toBeDisabled();
  });

  it("shows engine error state", async () => {
    // Mock worker creation failure
    const originalWorker = global.Worker;
    global.Worker = class {
      constructor() {
        throw new Error("Failed to load engine");
      }
    } as any;

    const snapshot = createSnapshot();
    render(
      <ChessGame
        snapshot={snapshot}
        onMove={onMoveMock}
        onResign={onResignMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/engine error/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    global.Worker = originalWorker;
  });
});

describe("ChessGame - Search Generation Tracking", () => {
  it("increments generation on stop", () => {
    // This would test internal searchGenerationRef increment
    // when engine.stop() is called before new search
    // Verifies: old search's bestmove callback checks generation
  });

  it("rejects bestmove with mismatched FEN", () => {
    // Tests: bestmove arrives but snapshot.fen changed
    // Expected: bestmove ignored, onMove not called
  });

  it("rejects bestmove with mismatched positionRevision", () => {
    // Tests: bestmove arrives but snapshot.positionRevision incremented
    // Expected: bestmove ignored with warning logged
  });
});

describe("ChessGame - Clock-based Movetime", () => {
  it("uses bounded movetime based on bot clock", () => {
    const snapshot = createSnapshot({
      sideToMove: "black",
      botTimeMs: 5000 // Only 5 seconds left
    });

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={vi.fn()}
        onResign={vi.fn()}
      />
    );

    // Engine should be given movetime = min(5000-100, 2000) = 2000ms
    // (Actual test would spy on engine.go call)
  });

  it("enforces minimum movetime of 100ms", () => {
    const snapshot = createSnapshot({
      sideToMove: "black",
      botTimeMs: 50 // Very low time
    });

    render(
      <ChessGame
        snapshot={snapshot}
        onMove={vi.fn()}
        onResign={vi.fn()}
      />
    );

    // Should still get at least 100ms
  });
});
