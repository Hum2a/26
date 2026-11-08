/**
 * Faithful Worker mock for testing StockfishEngine lifecycle.
 * Simulates UCI protocol responses without real WASM.
 */

export class WorkerMock {
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  public terminated = false;

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this.messageHandler = handler;
  }

  get onmessage() {
    return this.messageHandler;
  }

  set onerror(handler: ((event: ErrorEvent) => void) | null) {
    this.errorHandler = handler;
  }

  get onerror() {
    return this.errorHandler;
  }

  postMessage(data: string): void {
    if (this.terminated) {
      throw new Error("Worker is terminated");
    }

    // Simulate UCI protocol responses
    setTimeout(() => {
      if (this.terminated || !this.messageHandler) return;

      if (data === "uci") {
        this.simulateMessage("uciok");
      } else if (data === "isready") {
        this.simulateMessage("readyok");
      } else if (data.startsWith("setoption name UCI_Elo value")) {
        // Acknowledge Elo setting
        setTimeout(() => this.simulateMessage("readyok"), 10);
      } else if (data.startsWith("go movetime")) {
        // Simulate bestmove after delay
        setTimeout(() => {
          if (!this.terminated && this.messageHandler) {
            this.simulateMessage("bestmove e7e5");
          }
        }, 50);
      } else if (data === "stop") {
        // Immediate bestmove on stop
        this.simulateMessage("bestmove e7e5");
      }
    }, 10);
  }

  private simulateMessage(data: string): void {
    if (this.messageHandler && !this.terminated) {
      this.messageHandler({ data } as MessageEvent);
    }
  }

  terminate(): void {
    this.terminated = true;
    this.messageHandler = null;
    this.errorHandler = null;
  }

  addEventListener(type: string, listener: any): void {
    if (type === "message") {
      this.onmessage = listener;
    } else if (type === "error") {
      this.onerror = listener;
    }
  }

  removeEventListener(): void {
    // No-op for mock
  }
}
