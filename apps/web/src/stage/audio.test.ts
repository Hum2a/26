import { afterEach, describe, expect, it, vi } from "vitest";
import { createStageShow } from "./audio";

describe("stage audio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays only after unlock, and mute blocks the next sound", () => {
    const start = vi.fn();
    const stop = vi.fn();
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => undefined);
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          start,
          stop,
        };
      }
      createGain() {
        return { gain: { value: 0 }, connect() {} };
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const show = createStageShow();
    expect(show.play()).toBe(false);
    expect(start).not.toHaveBeenCalled();

    show.unlock();
    expect(show.play()).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);

    show.setMuted(true);
    expect(show.play()).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
  });
});
