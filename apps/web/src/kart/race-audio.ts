/**
 * Optional race sound, synthesised with Web Audio so no audio files ship:
 * an engine note that follows speed, and short chimes for the start, laps,
 * place gains and the finish. Off until the guest turns it on with a tap,
 * which is also what lets iOS start the audio context.
 */
export type RaceSound =
  "go" | "lap" | "final-lap" | "finish" | "place-up" | "slipstream";

type Context = Pick<
  AudioContext,
  "currentTime" | "destination" | "state" | "resume" | "suspend" | "close"
> & {
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBiquadFilter(): BiquadFilterNode;
};

const melodies: Record<RaceSound, readonly [frequency: number, seconds: number][]> = {
  go: [[880, 0.32]],
  lap: [
    [660, 0.1],
    [880, 0.18],
  ],
  "final-lap": [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.28],
  ],
  finish: [
    [523, 0.12],
    [659, 0.12],
    [784, 0.12],
    [1047, 0.12],
    [784, 0.12],
    [1047, 0.4],
  ],
  "place-up": [[740, 0.12]],
  slipstream: [
    [392, 0.08],
    [523, 0.14],
  ],
};

export const raceSoundKey = "26.kart.race-sound";

export function readRaceSoundPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(raceSoundKey) === "on";
  } catch {
    return false;
  }
}
export function writeRaceSoundPreference(on: boolean) {
  try {
    globalThis.localStorage?.setItem(raceSoundKey, on ? "on" : "off");
  } catch {
    // Private windows can refuse storage; the toggle still works this visit.
  }
}

export function createRaceAudio(
  factory: () => Context | null = () => {
    const Factory = globalThis.AudioContext;
    return Factory ? (new Factory() as Context) : null;
  },
) {
  let context: Context | null = null;
  let engine: { osc: OscillatorNode; gain: GainNode } | null = null;
  let enabled = false;

  function startEngine(active: Context) {
    const osc = active.createOscillator(),
      filter = active.createBiquadFilter(),
      gain = active.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 55;
    filter.type = "lowpass";
    filter.frequency.value = 700;
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(active.destination);
    osc.start();
    engine = { osc, gain };
  }

  return {
    get enabled() {
      return enabled;
    },
    /** Call from a tap. Returns false when this browser has no Web Audio. */
    enable(): boolean {
      try {
        context ??= factory();
        if (!context) return false;
        if (context.state === "suspended") void context.resume().catch(() => {});
        if (!engine) startEngine(context);
        enabled = true;
        return true;
      } catch {
        enabled = false;
        return false;
      }
    },
    disable() {
      enabled = false;
      if (engine && context)
        engine.gain.gain.setTargetAtTime(0, context.currentTime, 0.05);
    },
    /** `ratio` is speed over top speed; `running` is false when the kart can't drive. */
    engine(ratio: number, running: boolean) {
      if (!enabled || !engine || !context) return;
      const r = Number.isFinite(ratio)
        ? Math.max(0, Math.min(1.3, Math.abs(ratio)))
        : 0;
      const at = context.currentTime;
      engine.osc.frequency.setTargetAtTime(55 + 150 * r, at, 0.08);
      engine.gain.gain.setTargetAtTime(running ? 0.025 + 0.03 * r : 0, at, 0.1);
    },
    cue(sound: RaceSound) {
      if (!enabled || !context) return;
      let at = context.currentTime + 0.01;
      for (const [frequency, seconds] of melodies[sound]) {
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.type = "square";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.06, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(at);
        osc.stop(at + seconds + 0.02);
        at += seconds * 0.9;
      }
    },
    dispose() {
      enabled = false;
      try {
        engine?.osc.stop();
      } catch {
        // Already stopped.
      }
      engine = null;
      void context?.close().catch(() => {});
      context = null;
    },
  };
}
export type RaceAudio = ReturnType<typeof createRaceAudio>;
