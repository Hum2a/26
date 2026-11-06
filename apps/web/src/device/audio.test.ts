import { afterEach, expect, it, vi } from "vitest";
import { createScreenAudio } from "./audio";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("creates no context before a gesture, bounds tones, disposes once and can reopen explicitly", () => {
  const start = vi.fn(),
    stop = vi.fn(),
    close = vi.fn(async () => undefined),
    created = vi.fn();
  const frequency = { value: 0 },
    gain = { value: 0 };
  class Context {
    state = "running";
    currentTime = 3;
    destination = {};
    constructor() {
      created();
    }
    resume = async () => undefined;
    close = close;
    createOscillator() {
      return { frequency, connect() {}, start, stop };
    }
    createGain() {
      return { gain, connect() {} };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const audio = createScreenAudio();
  expect(audio.play()).toBe(false);
  expect(created).not.toHaveBeenCalled();
  expect(audio.unlock()).toBe(true);
  expect(audio.play({ frequency: 99999, volume: 50, durationMs: 9999 })).toBe(true);
  expect(frequency.value).toBe(2000);
  expect(gain.value).toBe(0.1);
  expect(stop).toHaveBeenLastCalledWith(4);
  audio.dispose();
  audio.dispose();
  expect(close).toHaveBeenCalledTimes(1);
  expect(audio.play()).toBe(false);
  audio.unlock();
  expect(created).toHaveBeenCalledTimes(2);
  audio.dispose();
});
it("handles refused construction and asynchronous resume without throwing or queued sound", async () => {
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw new Error("Blocked");
      }
    },
  );
  expect(createScreenAudio().unlock()).toBe(false);
  class Refused {
    resume = async () => {
      throw new Error("Denied");
    };
  }
  vi.stubGlobal("AudioContext", Refused);
  const audio = createScreenAudio();
  audio.unlock();
  await Promise.resolve();
  await Promise.resolve();
  expect(audio.unlocked).toBe(false);
  expect(audio.play()).toBe(false);
});
it("does not start a URL that finished downloading after its owner was disposed", async () => {
  let respond!: (response: Response) => void;
  const start = vi.fn();
  class Context {
    state = "running";
    resume = async () => undefined;
    close = async () => undefined;
    decodeAudioData = vi.fn();
    createBufferSource() {
      return { start };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    ),
  );
  const audio = createScreenAudio();
  audio.unlock();
  const pending = audio.playUrl("/sample");
  audio.dispose();
  respond(new Response(new Uint8Array([1])));
  expect(await pending).toBe(false);
  expect(start).not.toHaveBeenCalled();
});

it("cancels pending URL playback on stop even if sound is then re-enabled", async () => {
  let respond!: (response: Response) => void;
  const decode = vi.fn();
  class Context {
    state = "running";
    resume = async () => undefined;
    decodeAudioData = decode;
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    ),
  );
  const audio = createScreenAudio();
  audio.unlock();
  const pending = audio.playUrl("/sample");
  audio.setMuted(true);
  audio.setMuted(false);
  respond(new Response(new Uint8Array([1])));
  expect(await pending).toBe(false);
  expect(decode).not.toHaveBeenCalled();
});
