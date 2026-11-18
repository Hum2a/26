import { useSyncExternalStore } from "react";
import { identityFor, type ThemeIdentity } from "./identity";
import { activeThemeId, themeChangeEvent } from "./install";
import type { ThemeId } from "./themes";

function subscribe(onChange: () => void) {
  window.addEventListener(themeChangeEvent, onChange);
  return () => window.removeEventListener(themeChangeEvent, onChange);
}

/** The theme this screen shows, kept current when the guest switches theme. */
export function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribe, activeThemeId, activeThemeId);
}

/** The active theme's identity: family skin and deep layer plus its own flavour. */
export function useThemeIdentity(): ThemeIdentity {
  return identityFor(useThemeId());
}
