type Started = { start: () => void; stop: () => void };

/** What `layerUrl` did: played, skipped (limits, lock, mute or stop), or the file failed. */
export type LayerResult = "played" | "skipped" | "failed";

/**
 * One optional audio output per screen owner. Explicit gestures unlock it;
 * mute/dispose stop it. No context exists until the user asks for sound.
 *
 * `playUrl` plays one sound at a time. `layerUrl` lets short sounds overlap,
 * up to `maxVoices` at once and no closer than `minGapMs`, from a decoded
 * cache. `stop` ends both.
 */
export function createScreenAudio() {
  let context: AudioContext | null = null;
  let unlocked = false;
  let muted = false;
  let current: Started | null = null;
  let generation = 0;
  const voices = new Set<Started>();
  let pendingLayers = 0;
  let lastLayerAt = Number.NEGATIVE_INFINITY;
  let buffers = new Map<string, Promise<AudioBuffer | null>>();

  function stop() {
    generation++;
    for (const source of [current, ...voices]) {
      try {
        source?.stop();
      } catch {
        // The source had already finished.
      }
    }
    current = null;
    voices.clear();
  }

  /** A decoded clip, shared by every layer of it. A failed load stays failed. */
  function loadBuffer(active: AudioContext, url: string) {
    let cached = buffers.get(url);
    if (!cached) {
      cached = fetch(url)
        .then(async (response) =>
          response.ok ? active.decodeAudioData(await response.arrayBuffer()) : null,
        )
        .catch(() => null);
      buffers.set(url, cached);
    }
    return cached;
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
      buffers = new Map();
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
    async layerUrl(
      url: string,
      { maxVoices = 3, minGapMs = 0 }: { maxVoices?: number; minGapMs?: number } = {},
    ): Promise<LayerResult> {
      const active = context;
      if (!unlocked || muted || !active || url.length === 0) {
        return "skipped";
      }
      const at = performance.now();
      if (voices.size + pendingLayers >= maxVoices || at - lastLayerAt < minGapMs) {
        return "skipped";
      }
      const previous = lastLayerAt;
      lastLayerAt = at;
      pendingLayers++;
      const requested = generation;
      try {
        const buffer = await loadBuffer(active, url);
        if (!buffer) {
          // A fallback clip may take this slot straight away.
          lastLayerAt = previous;
          return "failed";
        }
        if (!unlocked || muted || active !== context || requested !== generation) {
          return "skipped";
        }
        const source = active.createBufferSource();
        source.buffer = buffer;
        const gain = active.createGain();
        gain.gain.value = 0.9;
        source.connect(gain);
        gain.connect(active.destination);
        source.onended = () => voices.delete(source);
        source.start();
        voices.add(source);
        return "played";
      } catch {
        return "failed";
      } finally {
        pendingLayers--;
      }
    },
  };
}
