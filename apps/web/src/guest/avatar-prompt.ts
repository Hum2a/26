/** Profile photos are drawn small (bubbles, standings), so they are sent small. */
export const avatarEdge = 384;

/** Whether this phone has already put off the welcome photo card for this game. */
export function avatarPromptSkipped(gameId: string): boolean {
  try {
    return window.sessionStorage.getItem(`avatar-skip:${gameId.toUpperCase()}`) === "1";
  } catch {
    return false;
  }
}

export function skipAvatarPrompt(gameId: string): void {
  try {
    window.sessionStorage.setItem(`avatar-skip:${gameId.toUpperCase()}`, "1");
  } catch {
    // Private mode: the card simply shows again next visit.
  }
}
