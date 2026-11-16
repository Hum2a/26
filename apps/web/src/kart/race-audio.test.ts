import { afterEach, expect, it, vi } from "vitest";
import {
  createRaceAudio,
  raceSoundKey,
  readRaceSoundPreference,
  writeRaceSoundPreference,
} from "./race-audio";

function fakeContext() {
  const param = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const oscillators: { frequency: ReturnType<typeof param>; start: unknown }[] = [];
  const context = {
    currentTime: 1,
    destination: {},
    state: "suspended",
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const osc = {
        type: "",
        frequency: param(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({
      type: "",
      frequency: param(),
      connect: vi.fn(),
    })),
  };
  return { context, oscillators };
}

afterEach(() => localStorage.clear());

it("stays silent until enabled, then follows speed and plays chimes", () => {
  const { context, oscillators } = fakeContext();
  const audio = createRaceAudio(() => context as never);
  audio.engine(0.5, true);
  audio.cue("go");
  expect(context.createOscillator).not.toHaveBeenCalled();
  expect(audio.enable()).toBe(true);
  expect(context.resume).toHaveBeenCalled();
  expect(audio.enabled).toBe(true);
  // One engine oscillator, then the speed sets its pitch.
  expect(oscillators).toHaveLength(1);
  audio.engine(1, true);
  expect(oscillators[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
    205,
    1,
    0.08,
  );
  // A bad speed falls back to idle rather than throwing.
  audio.engine(Number.NaN, true);
  expect(oscillators[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
    55,
    1,
    0.08,
  );
  audio.cue("finish");
  expect(oscillators).toHaveLength(7);
  audio.disable();
  audio.cue("lap");
  expect(oscillators).toHaveLength(7);
  audio.dispose();
  expect(context.close).toHaveBeenCalled();
});

it("reports no sound when the browser has no Web Audio", () => {
  const audio = createRaceAudio(() => null);
  expect(audio.enable()).toBe(false);
  expect(audio.enabled).toBe(false);
});

it("remembers the choice on this phone and survives refused storage", () => {
  expect(readRaceSoundPreference()).toBe(false);
  writeRaceSoundPreference(true);
  expect(localStorage.getItem(raceSoundKey)).toBe("on");
  expect(readRaceSoundPreference()).toBe(true);
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(readRaceSoundPreference()).toBe(false);
  spy.mockRestore();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => writeRaceSoundPreference(false)).not.toThrow();
  write.mockRestore();
});
