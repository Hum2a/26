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

    // Simulate UCI protocol responses with minimal delays
    if (data === "uci") {
      setTimeout(() => this.simulateMessage("uciok"), 5);
    } else if (data === "isready") {
      setTimeout(() => this.simulateMessage("readyok"), 5);
    } else if (data.startsWith("setoption name UCI_Elo value")) {
      // Acknowledge Elo setting
      setTimeout(() => this.simulateMessage("readyok"), 5);
    } else if (data.startsWith("go movetime")) {
      // Simulate bestmove after short delay
      setTimeout(() => {
        if (!this.terminated && this.messageHandler) {
          this.simulateMessage("bestmove e7e5");
        }
      }, 20);
    } else if (data === "stop") {
      // Immediate bestmove on stop
      setTimeout(() => {
        if (!this.terminated && this.messageHandler) {
          this.simulateMessage("bestmove e7e5");
        }
      }, 5);
    } else if (data.startsWith("position")) {
      // Position commands don't require response
    }
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
