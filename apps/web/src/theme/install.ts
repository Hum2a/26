import { identityFor } from "./identity";
import {
  browserChromeFor,
  DEFAULT_THEME_ID,
  isThemeId,
  themes,
  type PartyTheme,
  type ThemeId,
} from "./themes";

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

/** Fired on `window` after a theme is applied, so mounted components can follow it. */
export const themeChangeEvent = "26-theme-change";

export function applyTheme(id: ThemeId) {
  const theme = themes[id];
  // The family skin and deep layer, with the theme's own flavour on top.
  const identity = identityFor(id);
  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.skin = identity.id;
  root.dataset.ground = identity.ground;
  root.dataset.shape = identity.shape;
  root.dataset.mark = identity.mark;
  root.dataset.finish = identity.finish;
  root.dataset.motif = identity.motif;
  if (identity.motif === "none") {
    delete root.dataset.motifIcon;
  } else {
    root.dataset.motifIcon = identity.icon;
  }
  root.dataset.type = identity.type;
  root.dataset.scene = identity.scene;
  root.dataset.texture = identity.texture;
  root.dataset.control = identity.control;
  root.dataset.panel = identity.panel;
  root.dataset.heading = identity.heading;
  root.dataset.motion = identity.motion;
  root.dataset.align = identity.align;
  root.dataset.marks = identity.marks;
  root.dataset.celebrate = identity.celebrate;
  root.dataset.transition = identity.transition;
  root.dataset.numerals = identity.numerals;
  root.dataset.ornament = identity.ornament;
  root.dataset.strength = identity.strength;
  ensureTextureLayer();
  root.style.colorScheme = theme.colorScheme;
  applyBrowserChrome(theme);
  rememberTheme(id);
  window.dispatchEvent(new CustomEvent(themeChangeEvent, { detail: id }));
}

/**
 * Keep the browser toolbar, status bar and overscroll on the theme background.
 * Every `theme-color` tag (unqualified, light and dark) gets that colour, and
 * `color-scheme` follows the theme so a light system does not paint a light bar
 * over a dark party, or the reverse.
 */
function applyBrowserChrome(theme: PartyTheme) {
  const chrome = browserChromeFor(theme);
  themeColorMeta().setAttribute("content", chrome.themeColor);
  for (const media of chrome.themeColorMedia) {
    themeColorMeta(media).setAttribute("content", chrome.themeColor);
  }
  schemeMeta("color-scheme").setAttribute("content", chrome.colorScheme);
  schemeMeta("supported-color-schemes").setAttribute("content", chrome.colorScheme);
}

function themeColorMeta(media?: string): HTMLMetaElement {
  const selector = media
    ? `meta[name="theme-color"][media="${media}"]`
    : 'meta[name="theme-color"]:not([media])';
  return ensureMeta(selector, "theme-color", media);
}

function schemeMeta(name: "color-scheme" | "supported-color-schemes"): HTMLMetaElement {
  return ensureMeta(`meta[name="${name}"]`, name);
}

function ensureMeta(selector: string, name: string, media?: string): HTMLMetaElement {
  const found = document.head.querySelector(selector);
  if (found instanceof HTMLMetaElement) {
    return found;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("name", name);
  if (media) {
    meta.setAttribute("media", media);
  }
  document.head.append(meta);
  return meta;
}

/**
 * One full-screen texture layer above the page (grain, scanlines, a vignette),
 * like a shader. It is faint, ignores the pointer and is hidden from assistive
 * technology. CSS decides what it draws from `data-texture`.
 */
function ensureTextureLayer() {
  if (document.querySelector(".deep-texture")) {
    return;
  }
  const layer = document.createElement("div");
  layer.className = "deep-texture";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
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
