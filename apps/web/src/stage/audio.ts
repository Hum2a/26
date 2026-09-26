type Started = { start: () => void; stop: () => void };

/**
 * Show audio for the stage. A browser will not play until Start show unlocks
 * the AudioContext. Mute stops whatever is playing and blocks the next sound.
 */
export function createStageShow() {
  let context: AudioContext | null = null;
  let unlocked = false;
  let muted = false;
  let current: Started | null = null;

  function stop() {
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
    unlock(): void {
      const Factory = globalThis.AudioContext;
      if (!Factory) {
        return;
      }
      if (!context) {
        context = new Factory();
      }
      void context.resume().catch(() => undefined);
      unlocked = true;
    },
    setMuted(next: boolean): void {
      muted = next;
      if (next) {
        stop();
      }
    },
    play(): boolean {
      if (!unlocked || muted || !context) {
        return false;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.08;
      oscillator.frequency.value = 440;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      current = oscillator;
      return true;
    },
    async playUrl(url: string): Promise<boolean> {
      const active = context;
      if (!unlocked || muted || !active || url.length === 0) {
        return false;
      }
      try {
        const response = await fetch(url);
        if (!response.ok || !unlocked || muted) {
          return false;
        }
        const buffer = await active.decodeAudioData(await response.arrayBuffer());
        if (!unlocked || muted) {
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

export const stageShow = createStageShow();
