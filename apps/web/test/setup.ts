import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

function installBrowserStubs(): void {
  const matchMedia = vi.fn((query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  const request = vi.fn(async (): Promise<WakeLockSentinel> => {
    let released = false;
    const sentinel = {
      get released() {
        return released;
      },
      type: "screen" as const,
      onrelease: null,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
      release: vi.fn(async () => {
        released = true;
      }),
    };
    return sentinel as WakeLockSentinel;
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    writable: true,
    value: { request },
  });

  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: vi.fn(() => true),
  });

  class StubAudioContext {
    currentTime = 0;
    destination = {};
    state: AudioContextState = "running";
    sampleRate = 48000;
    close = vi.fn(async () => {
      this.state = "closed";
    });
    createOscillator() {
      return {
        frequency: { value: 440 },
        connect() {
          return this;
        },
        start() {},
        stop() {},
        onended: null as (() => void) | null,
      };
    }
    createGain() {
      return {
        gain: { value: 1 },
        connect() {
          return this;
        },
      };
    }
  }

  vi.stubGlobal("AudioContext", StubAudioContext as unknown as typeof AudioContext);
}

installBrowserStubs();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  installBrowserStubs();
});
