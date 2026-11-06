type Started = { start: () => void; stop: () => void };

/**
 * One optional audio output per screen owner. Explicit gestures unlock it;
 * mute/dispose stop it. No context exists until the user asks for sound.
 */
export function createScreenAudio() {
  let context: AudioContext | null = null;
  let unlocked = false;
  let muted = false;
  let current: Started | null = null;
  let generation = 0;

  function stop() {
    generation++;
    try {
      current?.stop();
    } catch {
      // The source had already finished.
    }
    current = null;
  }

  return {
    get unlocked() {
      return unlocked;
    },
    get muted() {
      return muted;
    },
    stop,
    unlock(): boolean {
      const Factory = globalThis.AudioContext;
      if (!Factory) return false;
      try {
        context ??= new Factory();
        const active = context;
        unlocked = true;
        void Promise.resolve(active.resume()).catch(() => {
          if (context === active) unlocked = false;
        });
        return true;
      } catch {
        unlocked = false;
        return false;
      }
    },
    setMuted(next: boolean): void {
      muted = next;
      if (next) {
        stop();
      }
    },
    play(
      tone: { frequency?: number; durationMs?: number; volume?: number } = {},
    ): boolean {
      if (
        !unlocked ||
        muted ||
        !context ||
        context.state === "suspended" ||
        context.state === "closed"
      ) {
        return false;
      }
      const bound = (
        value: number | undefined,
        fallback: number,
        min: number,
        max: number,
      ) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback);
      try {
        stop();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = bound(tone.volume, 0.08, 0, 0.1);
        oscillator.frequency.value = bound(tone.frequency, 440, 80, 2000);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(
          context.currentTime + bound(tone.durationMs, 200, 40, 1000) / 1000,
        );
        current = oscillator;
        return true;
      } catch {
        return false;
      }
    },
    dispose(): void {
      stop();
      const active = context;
      context = null;
      unlocked = false;
      if (active && active.state !== "closed") {
        try {
          void Promise.resolve(active.close()).catch(() => undefined);
        } catch {
          /* Already refused or closed. */
        }
      }
    },
    async playUrl(url: string): Promise<boolean> {
      const active = context;
      if (!unlocked || muted || !active || url.length === 0) {
        return false;
      }
      stop();
      const requested = generation;
      try {
        const response = await fetch(url);
        if (
          !response.ok ||
          !unlocked ||
          muted ||
          active !== context ||
          requested !== generation
        ) {
          return false;
        }
        const buffer = await active.decodeAudioData(await response.arrayBuffer());
        if (!unlocked || muted || active !== context || requested !== generation) {
          return false;
        }
        const source = active.createBufferSource();
        source.buffer = buffer;
        const gain = active.createGain();
        gain.gain.value = 0.9;
        source.connect(gain);
        gain.connect(active.destination);
        source.start();
        current = source;
        return true;
      } catch {
        return false;
      }
    },
  };
}
