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

function layeringContext() {
  const started: { stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] =
    [];
  const decode = vi.fn(async () => ({}) as AudioBuffer);
  class Context {
    state = "running";
    destination = {};
    resume = async () => undefined;
    close = async () => undefined;
    decodeAudioData = decode;
    createGain() {
      return { gain: { value: 0 }, connect() {} };
    }
    createBufferSource() {
      const source = {
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        connect() {},
        start() {
          started.push(source);
        },
        stop: vi.fn(),
      };
      return source;
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const fetcher = vi.fn(async (url: string) =>
    url.includes("missing")
      ? new Response(null, { status: 404 })
      : new Response(new Uint8Array([1])),
  );
  vi.stubGlobal("fetch", fetcher);
  return { started, decode, fetcher };
}

it("layers short sounds within a voice cap and a minimum gap, from one decode", async () => {
  const { started, decode } = layeringContext();
  let clock = 1_000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const audio = createScreenAudio();
  expect(await audio.layerUrl("/pop.mp3")).toBe("skipped");
  audio.unlock();
  expect(await audio.layerUrl("/pop.mp3", { maxVoices: 2 })).toBe("played");
  expect(await audio.layerUrl("/pop.mp3", { maxVoices: 2 })).toBe("played");
  expect(await audio.layerUrl("/pop.mp3", { maxVoices: 2 })).toBe("skipped");
  expect(started).toHaveLength(2);
  expect(decode).toHaveBeenCalledTimes(1);
  // A finished voice frees its slot.
  started[0]?.onended?.();
  expect(await audio.layerUrl("/pop.mp3", { maxVoices: 2 })).toBe("played");
  // Stop ends every layer still playing, and the gap holds back the next one.
  audio.stop();
  expect(started[0]?.stop).not.toHaveBeenCalled();
  expect(started.slice(1).every((source) => source.stop.mock.calls.length > 0)).toBe(
    true,
  );
  clock += 1_000;
  expect(await audio.layerUrl("/ding.mp3", { minGapMs: 300 })).toBe("played");
  clock += 100;
  expect(await audio.layerUrl("/ding.mp3", { minGapMs: 300 })).toBe("skipped");
  clock += 300;
  expect(await audio.layerUrl("/ding.mp3", { minGapMs: 300 })).toBe("played");
  audio.dispose();
  vi.restoreAllMocks();
});

it("reports a missing file once, without spending the gap a fallback needs", async () => {
  const { started, fetcher } = layeringContext();
  vi.spyOn(performance, "now").mockReturnValue(5_000);
  const audio = createScreenAudio();
  audio.unlock();
  expect(await audio.layerUrl("/missing.mp3", { minGapMs: 300 })).toBe("failed");
  expect(await audio.layerUrl("/ding.mp3", { minGapMs: 300 })).toBe("played");
  expect(await audio.layerUrl("/missing.mp3")).toBe("failed");
  expect(fetcher.mock.calls.filter(([url]) => url === "/missing.mp3")).toHaveLength(1);
  expect(started).toHaveLength(1);
  audio.dispose();
  vi.restoreAllMocks();
});

it("does not start a layer that was still loading when sound stopped", async () => {
  layeringContext();
  const audio = createScreenAudio();
  audio.unlock();
  const pending = audio.layerUrl("/pop.mp3");
  audio.stop();
  expect(await pending).toBe("skipped");
  audio.dispose();
});
