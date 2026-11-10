import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StockfishEngine } from "./stockfish-worker";

/**
 * Production adapter test: Worker isolation prevents stale bestmove.
 * MUST import actual StockfishEngine, intercept real Worker creation,
 * deliver UNTAGGED late bestmove from workerA after goB starts.
 */

describe("StockfishEngine Worker isolation", () => {
  let originalWorker: typeof Worker;
  let createdWorkers: MockWorker[] = [];

  class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((error: ErrorEvent) => void) | null = null;
    terminated = false;

    postMessage(data: string): void {
      if (this.terminated) return;

      // Simulate UCI handshake sequence
      if (data === "uci") {
        setTimeout(() => {
          this.onmessage?.({ data: "uciok" } as MessageEvent);
        }, 10);
      } else if (data.startsWith("setoption name UCI_LimitStrength")) {
        setTimeout(() => {
          this.onmessage?.({
            data: "info string UCI_LimitStrength set",
          } as MessageEvent);
          this.onmessage?.({ data: "readyok" } as MessageEvent);
        }, 10);
      } else if (data.startsWith("setoption name UCI_Elo")) {
        setTimeout(() => {
          this.onmessage?.({ data: "info string UCI_Elo set" } as MessageEvent);
          this.onmessage?.({ data: "readyok" } as MessageEvent);
        }, 10);
      } else if (data === "isready") {
        setTimeout(() => {
          this.onmessage?.({ data: "readyok" } as MessageEvent);
        }, 10);
      } else if (data.startsWith("go movetime")) {
        // Simulate search completing after movetime
        const moveTime = parseInt(data.split(" ")[2]);
        setTimeout(() => {
          if (!this.terminated) {
            // Return bestmove (untagged UCI protocol)
            this.onmessage?.({ data: "bestmove e7e5" } as MessageEvent);
          }
        }, moveTime + 20);
      }
    }

    terminate(): void {
      this.terminated = true;
      this.onmessage = null;
      this.onerror = null;
    }
  }

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    createdWorkers = [];

    // @ts-expect-error -- Mock Worker constructor
    globalThis.Worker = class {
      constructor() {
        const worker = new MockWorker();
        createdWorkers.push(worker);
        return worker as unknown as Worker;
      }
    } as typeof Worker;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    createdWorkers = [];
  });

  it("MUST reject late workerA bestmove after goB starts, accept only workerB bestmove", async () => {
    const callbacks: string[] = [];

    const engine = new StockfishEngine({
      elo: 1425,
      onBestMove: (from, to) => {
        callbacks.push(`${from}${to}`);
      },
    });

    await engine.initialize();

    // Verify init worker created
    expect(createdWorkers.length).toBe(1);

    // Start searchA (long)
    engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    engine.go(1000); // 1000ms search

    // Verify searchA worker created
    expect(createdWorkers.length).toBe(2);
    const workerA = createdWorkers[1];
    expect(workerA.terminated).toBe(false);

    // Start searchB BEFORE workerA returns (supersedes A)
    await new Promise((resolve) => setTimeout(resolve, 50));
    engine.setPosition("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
    engine.go(200); // 200ms search

    // Verify workerA terminated, workerB created
    expect(workerA.terminated).toBe(true);
    expect(createdWorkers.length).toBe(3);
    const workerB = createdWorkers[2];
    expect(workerB.terminated).toBe(false);

    // Wait for both potential bestmoves
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // ASSERT: Only workerB bestmove delivered (workerA terminated before responding)
    expect(callbacks).toEqual(["e7e5"]); // workerB only
    expect(callbacks.length).toBe(1);

    engine.terminate();
  });

  it("single search delivers exactly one callback", async () => {
    const callbacks: string[] = [];

    const engine = new StockfishEngine({
      elo: 1425,
      onBestMove: (from, to) => {
        callbacks.push(`${from}${to}`);
      },
    });

    await engine.initialize();

    engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    engine.go(200);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(callbacks).toEqual(["e7e5"]);
    expect(callbacks.length).toBe(1);

    engine.terminate();
  });

  it("terminate prevents callbacks from active search worker", async () => {
    const callbacks: string[] = [];

    const engine = new StockfishEngine({
      elo: 1425,
      onBestMove: (from, to) => {
        callbacks.push(`${from}${to}`);
      },
    });

    await engine.initialize();

    engine.setPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    engine.go(500);

    // Terminate before search completes
    await new Promise((resolve) => setTimeout(resolve, 50));
    engine.terminate();

    // Verify search worker terminated
    expect(createdWorkers[1].terminated).toBe(true);

    // Wait for when bestmove would have arrived
    await new Promise((resolve) => setTimeout(resolve, 600));

    // No callback (worker terminated)
    expect(callbacks).toEqual([]);

    engine.terminate();
  });
});
