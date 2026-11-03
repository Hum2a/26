/**
 * After a deployment, a tab opened earlier still asks for the old build's
 * code files, which no longer exist. These helpers recognise that failure and
 * reload once, so the tab picks up the new build instead of showing an error.
 */
const reloadKey = "26-stale-build-reload";
/** A second failure this soon after reloading is a real fault, not a stale tab. */
const retryWindowMs = 30_000;

export function isStaleBuildError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    message,
  );
}

/**
 * Reloads the page once per short window. Returns false when it already tried,
 * so the caller can show a manual recovery screen instead of looping.
 */
/** Whether an automatic reload is still allowed: none ran in the last moment. */
export function canReloadForNewBuild(now = Date.now()): boolean {
  let last: number | null = null;
  try {
    const stored = sessionStorage.getItem(reloadKey);
    last = stored === null ? null : Number(stored);
  } catch {
    // Storage can be refused; a single reload attempt still helps.
  }
  return !(last !== null && Number.isFinite(last) && now - last < retryWindowMs);
}

export function reloadForNewBuild(
  now = Date.now(),
  reload: () => void = () => window.location.reload(),
): boolean {
  if (!canReloadForNewBuild(now)) {
    return false;
  }
  try {
    sessionStorage.setItem(reloadKey, String(now));
  } catch {
    // The reload still happens without the guard.
  }
  reload();
  return true;
}

/** Vite reports a failed code preload on the window; recover the same way. */
export function installStaleBuildRecovery(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewBuild()) {
      event.preventDefault();
    }
  });
}
