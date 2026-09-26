/**
 * Feature-detected vibration for the phone controller.
 * A haptic troll calls this same function. iOS Safari has no Vibration API,
 * so the call does nothing there.
 */
export function buzz(pattern: VibratePattern): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // The browser exposed vibrate and then refused the call.
  }
}
