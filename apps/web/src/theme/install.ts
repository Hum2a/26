import { DEFAULT_THEME_ID, isThemeId, themes, type ThemeId } from "./themes";

export function themeIdFromSearch(search: string): ThemeId {
  const requested = new URLSearchParams(search).get("theme");
  if (requested && isThemeId(requested)) {
    return requested;
  }
  return DEFAULT_THEME_ID;
}

export function installTheme(search = window.location.search): ThemeId {
  const id = themeIdFromSearch(search);
  const theme = themes[id];
  const root = document.documentElement;
  root.dataset.theme = id;
  root.style.colorScheme = theme.colorScheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme.colors.background);
  return id;
}
