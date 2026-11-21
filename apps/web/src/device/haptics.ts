/**
 * Feature-detected vibration for the phone controller.
 * A haptic troll calls this same function. iOS Safari has no Vibration API,
 * so the call does nothing there.
 */
export function buzz(
  pattern: VibratePattern,
  options: { evenWhileMuted?: boolean } = {},
): void {
  // A preview mutes gag buzzing; a phone's own feedback can still buzz.
  if (muted > 0 && !options.evenWhileMuted) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // The browser exposed vibrate and then refused the call.
  }
}

let muted = 0;

/**
 * Silences `buzz` while something that only shows a troll, such as the troll
 * tab's preview, is on screen. Returns the undo; calling it twice is safe.
 */
export function muteHaptics(): () => void {
  muted += 1;
  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    muted -= 1;
  };
}
