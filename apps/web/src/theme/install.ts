import { skinFor } from "./skins";
import { DEFAULT_THEME_ID, isThemeId, themes, type ThemeId } from "./themes";

const themeStorageKey = "26-theme";

export function themeIdFromSearch(search: string): ThemeId {
  const requested = new URLSearchParams(search).get("theme");
  if (requested && isThemeId(requested)) {
    return requested;
  }
  return DEFAULT_THEME_ID;
}

function readStoredTheme(): ThemeId | null {
  try {
    const stored = sessionStorage.getItem(themeStorageKey);
    if (stored && isThemeId(stored)) {
      return stored;
    }
  } catch {
    // Private browsing can refuse storage. The page still gets a theme.
  }
  return null;
}

function rememberTheme(id: ThemeId) {
  try {
    sessionStorage.setItem(themeStorageKey, id);
  } catch {
    // The chosen theme still applies for this page.
  }
}

export function applyTheme(id: ThemeId) {
  const theme = themes[id];
  const skin = skinFor(id);
  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.skin = skin.id;
  root.dataset.ground = skin.ground;
  root.dataset.shape = skin.shape;
  root.dataset.mark = skin.mark;
  root.style.colorScheme = theme.colorScheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme.colors.background);
  rememberTheme(id);
}

export function activeThemeId(): ThemeId {
  const current = document.documentElement.dataset.theme;
  if (current && isThemeId(current)) {
    return current;
  }
  return DEFAULT_THEME_ID;
}

export function installTheme(search = window.location.search): ThemeId {
  const requested = new URLSearchParams(search).get("theme");
  const id =
    requested && isThemeId(requested)
      ? requested
      : (readStoredTheme() ?? DEFAULT_THEME_ID);
  applyTheme(id);
  return id;
}
