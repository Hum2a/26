/**
 * Fullscreen for the projector. A missing API or a refused request does nothing.
 */
export function requestStageFullscreen(
  element: HTMLElement = document.documentElement,
): void {
  try {
    if (typeof element.requestFullscreen !== "function") {
      return;
    }
    void element.requestFullscreen().catch(() => undefined);
  } catch {
    // The browser exposed fullscreen and then refused the call.
  }
}
