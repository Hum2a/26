import { createContext, useCallback, useContext, useEffect } from "react";
import { createScreenAudio, type LayerResult } from "../device/audio";

/**
 * The one sound output for trolls drawn on this phone. Browsers only allow
 * audio after a tap, so any tap on the phone quietly unlocks it. A gag that
 * cannot play its sound still runs silently.
 */
export const trollSound = createScreenAudio();

export type TrollSound = Pick<typeof trollSound, "playUrl" | "layerUrl" | "stop">;

/** Gags read their sound from here, so a test or preview can swap it. */
export const TrollSoundContext = createContext<TrollSound>(trollSound);

/** Unlocks troll sound on each tap, which also resumes a suspended context. */
export function useTrollSoundUnlock(sound: { unlock(): boolean } = trollSound) {
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [sound]);
}

/**
 * Plays `url` once while the calling gag is on screen, after `delayMs`, and
 * stops it when the gag ends. `null` plays nothing, which also stops the last
 * clip when a gag moves on.
 */
export function useTrollClip(url: string | null, delayMs = 0) {
  const sound = useContext(TrollSoundContext);
  useEffect(() => {
    if (!url) {
      return;
    }
    if (delayMs <= 0) {
      void sound.playUrl(url);
      return () => sound.stop();
    }
    const timer = window.setTimeout(() => void sound.playUrl(url), delayMs);
    return () => {
      window.clearTimeout(timer);
      sound.stop();
    };
  }, [url, delayMs, sound]);
}

type LayerLimits = { maxVoices?: number; minGapMs?: number };

/**
 * Returns a function that plays a short sound over any already playing, within
 * `limits`. A `fallback` plays only when the first file fails to load, not when
 * the limits skip it. Everything stops when the gag ends.
 */
export function useTrollLayer(limits: LayerLimits = {}) {
  const sound = useContext(TrollSoundContext);
  const { maxVoices, minGapMs } = limits;
  useEffect(() => () => sound.stop(), [sound]);
  return useCallback(
    async (url: string, fallback?: string): Promise<LayerResult> => {
      const result = await sound.layerUrl(url, { maxVoices, minGapMs });
      return result === "failed" && fallback
        ? sound.layerUrl(fallback, { maxVoices, minGapMs })
        : result;
    },
    [sound, maxVoices, minGapMs],
  );
}
