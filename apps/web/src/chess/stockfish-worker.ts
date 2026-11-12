/**
 * Stockfish Web Worker wrapper with UCI protocol support.
 * Loads stockfish-19-lite-single WASM engine and communicates via UCI commands.
 */

export type StockfishOptions = {
  /** UCI_Elo strength (1320-3190, default 1425) */
  elo?: number;
  /** Time to think in milliseconds */
  moveTimeMs?: number;
  /** Callback when engine is ready */
  onReady?: () => void;
  /** Callback when best move is found */
  onBestMove?: (from: string, to: string, promotion?: string) => void;
  /** Callback for engine errors */
  onError?: (error: string) => void;
};

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private options: Required<StockfishOptions>;
  private currentPosition = "";
  private activeSearchWorker: Worker | null = null; // Current search's isolated Worker
  // The search worker asked to stop: it reports its best move but must not start a search.
  private stoppingWorker: Worker | null = null;

  constructor(options: StockfishOptions = {}) {
    this.options = {
      elo: options.elo ?? 1425,
      moveTimeMs: options.moveTimeMs ?? 2000,
      onReady: options.onReady ?? (() => {}),
      onBestMove: options.onBestMove ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  /**
   * Initialize and load the Stockfish worker.
   * Returns a promise that resolves when the engine is ready.
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return Promise.reject(new Error("Engine already initialized"));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let initWorker: Worker | null = null;
      const cleanupInitWorker = () => {
        if (initWorker) {
          initWorker.onmessage = null;
          initWorker.onerror = null;
          initWorker.terminate();
          if (this.worker === initWorker) {
            this.worker = null;
          }
          initWorker = null;
        }
      };

      const timeout = setTimeout(() => {
        if (settled || this.worker !== initWorker) {
          settled = true;
          return;
        }
        settled = true;
        cleanupInitWorker();
        const message = "Stockfish initialization timeout (10s)";
        this.options.onError(message);
        reject(new Error(message));
      }, 10_000);

      try {
        // Load the Stockfish worker
        initWorker = new Worker("/chess-engine/stockfish-19-lite-single.js");
        this.worker = initWorker;

        initWorker.onmessage = (event) => {
          if (settled || this.worker !== initWorker) return;
          const line = event.data as string;
          this.handleMessage(line);

          if (line === "uciok") {
            // UCI handshake complete, now set options
            this.sendCommand("setoption name UCI_LimitStrength value true");
            this.sendCommand(`setoption name UCI_Elo value ${this.options.elo}`);
            this.sendCommand("isready");
          }

          if (line === "readyok") {
            settled = true;
            this.ready = true;
            clearTimeout(timeout);
            // Release the handshake probe worker immediately; each go() runs in
            // its own isolated worker so no idle WASM instance sits in memory.
            cleanupInitWorker();
            this.options.onReady();
            resolve();
          }
        };

        initWorker.onerror = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          cleanupInitWorker();
          const message = `Stockfish worker error: ${error.message}`;
          this.options.onError(message);
          reject(new Error(message));
        };

        // Start UCI handshake
        this.sendCommand("uci");
      } catch (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        cleanupInitWorker();
        const message = `Failed to create Stockfish worker: ${error instanceof Error ? error.message : String(error)}`;
        this.options.onError(message);
        reject(new Error(message));
      }
    });
  }

  /**
   * Set the position from FEN and move history.
   */
  setPosition(fen: string, moves: string[] = []): void {
    const movesStr = moves.length > 0 ? ` moves ${moves.join(" ")}` : "";
    this.currentPosition = `position fen ${fen}${movesStr}`;
  }

  /**
   * Request the engine to find the best move.
   * Each fresh Worker completes full UCI handshake BEFORE search.
   * Immutable Worker isolation prevents stale bestmove delivery.
   */
  go(timeMs?: number): void {
    if (!this.ready) {
      this.options.onError("Engine not ready");
      return;
    }

    if (!this.currentPosition) {
      this.options.onError("No position set");
      return;
    }

    // Terminate any in-flight search Worker
    if (this.activeSearchWorker) {
      this.activeSearchWorker.terminate();
      this.activeSearchWorker = null;
    }
    this.stoppingWorker = null;

    // Create fresh Worker for THIS search only
    const searchWorker = new Worker("/chess-engine/stockfish-19-lite-single.js");
    this.activeSearchWorker = searchWorker;

    // Capture position and movetime for this search
    const capturedPosition = this.currentPosition;
    const capturedMoveTime = timeMs ?? this.options.moveTimeMs;

    // Track UCI handshake state for this Worker
    let uciComplete = false;
    // One search and one answer per Worker, however many `readyok` lines arrive.
    let searchStarted = false;
    let answered = false;

    // Handler for THIS Worker's messages only
    searchWorker.onmessage = (event) => {
      const line = event.data as string;

      // UCI handshake: uci → uciok → setoption(both) → isready → readyok → position+go
      // CRITICAL: UCI setoption has NO ack/confirmation message
      if (line === "uciok") {
        uciComplete = true;
        // Send BOTH options then isready (options have no ack)
        searchWorker.postMessage("setoption name UCI_LimitStrength value true");
        searchWorker.postMessage(`setoption name UCI_Elo value ${this.options.elo}`);
        searchWorker.postMessage("isready");
      } else if (
        line === "readyok" &&
        uciComplete &&
        !searchStarted &&
        this.stoppingWorker !== searchWorker
      ) {
        // Engine ready after options set, NOW send search. A stray second
        // `readyok` must not start the same search again.
        searchStarted = true;
        searchWorker.postMessage(capturedPosition);
        searchWorker.postMessage(`go movetime ${capturedMoveTime}`);
      }

      // Parse bestmove response
      if (line.startsWith("bestmove ")) {
        if (answered) return;
        answered = true;
        // The search is over: release its WASM Worker once this answer is handled.
        queueMicrotask(() => this.finishSearch(searchWorker));
        const parts = line.split(" ");
        const move = parts[1];

        if (move === "(none)" || move === "0000") {
          // Callback suppressed if Worker no longer active
          if (this.activeSearchWorker === searchWorker) {
            this.options.onError("Engine returned no move");
          }
          return;
        }

        // Parse UCI move format
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.length > 4 ? move.substring(4, 5) : undefined;

        // Deliver callback only if this Worker still active
        if (this.activeSearchWorker === searchWorker) {
          this.options.onBestMove(from, to, promotion);
        }
        // Otherwise: stale Worker, callback suppressed
      }
    };

    searchWorker.onerror = (error) => {
      // Error callback only if this Worker still active
      if (this.activeSearchWorker === searchWorker) {
        this.options.onError(`Search worker error: ${error.message}`);
        this.finishSearch(searchWorker);
      }
    };

    // Start UCI handshake (uci → uciok → strength → elo → isready → readyok → position+go)
    searchWorker.postMessage("uci");
  }

  /**
   * Stop the current search (UCI `stop`): a search in progress reports its
   * best move so far through `onBestMove`, and a search still in its
   * handshake never starts. Callers that only want to cancel drop that late
   * answer (chess-game checks its search state); `go()` and `terminate()`
   * end the Worker either way.
   */
  stop(): void {
    const worker = this.activeSearchWorker;
    if (!worker) return;
    this.stoppingWorker = worker;
    try {
      worker.postMessage("stop");
    } catch {
      // A Worker that cannot take messages any more has nothing to report.
      this.finishSearch(worker);
    }
  }

  /** Ends one search Worker, if it is still the current one. */
  private finishSearch(worker: Worker): void {
    if (this.stoppingWorker === worker) this.stoppingWorker = null;
    if (this.activeSearchWorker !== worker) return;
    worker.terminate();
    this.activeSearchWorker = null;
  }

  /**
   * Terminate the worker and clean up.
   */
  terminate(): void {
    this.ready = false;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.activeSearchWorker) {
      this.activeSearchWorker.terminate();
      this.activeSearchWorker = null;
    }
    this.stoppingWorker = null;
  }

  /**
   * Check if the engine is ready.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Send a UCI command to the engine.
   */
  private sendCommand(command: string): void {
    if (!this.worker) {
      this.options.onError("Worker not initialized");
      return;
    }

    this.worker.postMessage(command);
  }

  /**
   * Handle messages from the init worker.
   */
  private handleMessage(line: string): void {
    void line;
    // Init worker only handles UCI handshake, not searches
    // Search workers handle their own bestmove via go() closure
  }

  /**
   * Update engine strength (UCI_Elo).
   */
  setStrength(elo: number): void {
    if (!this.ready) {
      this.options.onError("Engine not ready");
      return;
    }

    if (elo < 1320 || elo > 3190) {
      this.options.onError(`UCI_Elo must be between 1320 and 3190, got ${elo}`);
      return;
    }

    this.options.elo = elo;
    if (this.worker) {
      this.sendCommand("setoption name UCI_LimitStrength value true");
      this.sendCommand(`setoption name UCI_Elo value ${elo}`);
      this.sendCommand("isready");
    }
  }
}

/**
 * Create and initialize a Stockfish engine instance.
 * Convenience wrapper for common use case.
 */
export async function createStockfishEngine(
  options?: StockfishOptions,
): Promise<StockfishEngine> {
  const engine = new StockfishEngine(options);
  await engine.initialize();
  return engine;
}
