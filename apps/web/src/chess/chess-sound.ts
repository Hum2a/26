import { createScreenAudio } from "../device/audio";

export type ChessSound =
  "move" | "capture" | "check" | "castle" | "promote" | "win" | "lose" | "low-time";

const storageKey = "26-chess-muted";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

/**
 * The board's optional sounds. Nothing plays, and no audio context exists,
 * until the guest touches the board; a mute choice is remembered on this
 * phone. Clips are small, decoded once and may overlap briefly.
 */
export function createChessSound() {
  const audio = createScreenAudio();
  audio.setMuted(readMuted());
  return {
    get muted() {
      return audio.muted;
    },
    /** Call from a tap or key press: browsers only allow sound after one. */
    unlock(): void {
      if (!audio.unlocked) audio.unlock();
    },
    setMuted(muted: boolean): void {
      audio.setMuted(muted);
      try {
        window.localStorage.setItem(storageKey, muted ? "1" : "0");
      } catch {
        // Private mode: the choice lasts for this page only.
      }
    },
    play(sound: ChessSound): void {
      void audio.layerUrl(`/assets/chess/sounds/${sound}.mp3`, {
        maxVoices: 3,
        minGapMs: 40,
      });
    },
    dispose(): void {
      audio.dispose();
    },
  };
}

export type ChessSoundPlayer = ReturnType<typeof createChessSound>;
