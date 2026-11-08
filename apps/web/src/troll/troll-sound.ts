import { useEffect } from "react";
import { createScreenAudio } from "../device/audio";

/**
 * The one sound output for trolls drawn on this phone. Browsers only allow
 * audio after a tap, so any tap on the phone quietly unlocks it. A gag that
 * cannot play its sound still runs silently.
 */
export const trollSound = createScreenAudio();

export type TrollSound = Pick<typeof trollSound, "playUrl" | "stop">;

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

/** Plays `url` while the calling gag is on screen and stops it when the gag ends. */
export function useTrollClip(url: string, sound: TrollSound = trollSound) {
  useEffect(() => {
    void sound.playUrl(url);
    return () => sound.stop();
  }, [url, sound]);
}
