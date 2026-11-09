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
  async   initialize(): Promise<void> {
    if (this.ready) {
      return Promise.reject(new Error("Engine already initialized"));
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Stockfish initialization timeout (10s)"));
      }, 10_000);

      try {
        // Load the Stockfish worker
        this.worker = new Worker("/chess-engine/stockfish-19-lite-single.js");

        this.worker.onmessage = (event) => {
          const line = event.data as string;
          this.handleMessage(line);

          if (line === "uciok") {
            // UCI handshake complete, now set options
            this.sendCommand("setoption name UCI_LimitStrength value true");
            this.sendCommand(`setoption name UCI_Elo value ${this.options.elo}`);
            this.sendCommand("isready");
          }

          if (line === "readyok") {
            this.ready = true;
            clearTimeout(timeout);
            this.options.onReady();
            resolve();
          }
        };

        this.worker.onerror = (error) => {
          clearTimeout(timeout);
          const message = `Stockfish worker error: ${error.message}`;
          this.options.onError(message);
          reject(new Error(message));
        };

        // Start UCI handshake
        this.sendCommand("uci");
      } catch (error) {
        clearTimeout(timeout);
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
   * Terminates old search Worker, creates fresh Worker for new search.
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

    // Terminate any in-flight search Worker (different Worker = no stale callbacks)
    if (this.activeSearchWorker) {
      this.activeSearchWorker.terminate();
      this.activeSearchWorker = null;
    }

    // Create fresh Worker for THIS search only
    const searchWorker = new Worker("/chess-engine/stockfish-19-lite-single.js");
    this.activeSearchWorker = searchWorker;

    // Capture callback for THIS Worker's bestmove only
    searchWorker.onmessage = (event) => {
      const line = event.data as string;

      // Parse bestmove response
      if (line.startsWith("bestmove ")) {
        const parts = line.split(" ");
        const move = parts[1];

        if (move === "(none)" || move === "0000") {
          this.options.onError("Engine returned no move");
          return;
        }

        // Parse UCI move format
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.length > 4 ? move.substring(4, 5) : undefined;

        // Callback delivered only if this Worker still active
        if (this.activeSearchWorker === searchWorker) {
          this.options.onBestMove(from, to, promotion);
        }
        // Otherwise: stale Worker, callback suppressed
      }

      // Handle UCI handshake for this Worker
      if (line === "uciok") {
        searchWorker.postMessage("setoption name UCI_LimitStrength value true");
        searchWorker.postMessage(`setoption name UCI_Elo value ${this.options.elo}`);
        searchWorker.postMessage("isready");
      }

      if (line === "readyok") {
        // Worker ready, dispatch position + go
        searchWorker.postMessage(this.currentPosition);
        const moveTime = timeMs ?? this.options.moveTimeMs;
        searchWorker.postMessage(`go movetime ${moveTime}`);
      }
    };

    searchWorker.onerror = (error) => {
      this.options.onError(`Search worker error: ${error.message}`);
    };

    // Start UCI handshake
    searchWorker.postMessage("uci");
  }

  /**
   * Stop the current search.
   * Terminates active search Worker.
   */
  stop(): void {
    if (this.activeSearchWorker) {
      this.activeSearchWorker.terminate();
      this.activeSearchWorker = null;
    }
  }

  /**
   * Terminate the worker and clean up.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
    if (this.activeSearchWorker) {
      this.activeSearchWorker.terminate();
      this.activeSearchWorker = null;
    }
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
  private handleMessage(_line: string): void {
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
    this.sendCommand("setoption name UCI_LimitStrength value true");
    this.sendCommand(`setoption name UCI_Elo value ${elo}`);
    this.sendCommand("isready");
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
