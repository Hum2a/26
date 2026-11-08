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
  private pendingMessages: string[] = [];
  private options: Required<StockfishOptions>;
  private currentPosition = "";

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
   * Time limit is bounded by options.moveTimeMs.
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

    // Set position
    this.sendCommand(this.currentPosition);

    // Start search with time limit
    const moveTime = timeMs ?? this.options.moveTimeMs;
    this.sendCommand(`go movetime ${moveTime}`);
  }

  /**
   * Stop the current search.
   */
  stop(): void {
    if (this.worker && this.ready) {
      this.sendCommand("stop");
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
      this.pendingMessages = [];
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
   * Handle messages from the engine.
   */
  private handleMessage(line: string): void {
    // Parse bestmove response
    if (line.startsWith("bestmove ")) {
      const parts = line.split(" ");
      const move = parts[1];

      if (move === "(none)" || move === "0000") {
        this.options.onError("Engine returned no move");
        return;
      }

      // Parse UCI move format (e.g., "e2e4", "e7e8q" for promotion)
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move.substring(4, 5) : undefined;

      this.options.onBestMove(from, to, promotion);
    }

    // Log info lines for debugging (can be removed in production)
    if (line.startsWith("info ")) {
      // Optional: parse score, depth, etc.
      // For now, we just pass through
    }
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
