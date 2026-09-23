/**
 * Party colour palettes. This file is the only place colour values are written.
 * Add a theme by appending one object. Preview it with `?theme=its-id`.
 * Change `DEFAULT_THEME_ID` to make that theme the party default.
 */

export const paletteRoles = [
  "background",
  "foreground",
  "muted",
  "accent",
  "accentForeground",
  "highlight",
  "highlightForeground",
  "surface",
  "surfaceForeground",
  "line",
  "mark",
  "markQuiet",
] as const;

export type PaletteRole = (typeof paletteRoles)[number];

export type Palette = Record<PaletteRole, string>;

export type ColorScheme = "dark" | "light";

export type PartyTheme = {
  id: string;
  name: string;
  colorScheme: ColorScheme;
  colors: Palette;
};

const themeIdPattern = /^[a-z0-9-]+$/;

function paletteVariable(role: PaletteRole): string {
  return `--${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function assertTheme(theme: PartyTheme) {
  if (!themeIdPattern.test(theme.id)) {
    throw new Error(
      `Theme id "${theme.id}" must use lowercase letters, numbers, and hyphens.`,
    );
  }
  if (theme.colorScheme !== "dark" && theme.colorScheme !== "light") {
    throw new Error(`Theme "${theme.id}" must set colorScheme to dark or light.`);
  }
  for (const role of paletteRoles) {
    const value = theme.colors[role];
    if (value.trim() !== value || /[;{}<>\\]/.test(value) || /[\r\n]/.test(value)) {
      throw new Error(`Theme "${theme.id}" has an unsafe ${role} colour.`);
    }
  }
}

export const themes = {
  // Current party look. public/favicon.svg is a static mark using this accent and background.
  "26-basic": {
    id: "26-basic",
    name: "26 basic",
    colorScheme: "dark",
    colors: {
      background: "#14110e",
      foreground: "#fff6e8",
      muted: "#e4d5c0",
      accent: "#ff4d3a",
      accentForeground: "#1a100e",
      highlight: "#ffc43a",
      highlightForeground: "#1a100e",
      surface: "#2c241c",
      surfaceForeground: "#fff6e8",
      line: "#5c5144",
      mark: "#14110e",
      markQuiet: "#fff6e8",
    },
  },
} as const satisfies Record<string, PartyTheme>;

for (const key of Object.keys(themes)) {
  const theme = themes[key as ThemeId];
  if (theme.id !== key) {
    throw new Error(`Theme key "${key}" does not match its id "${theme.id}".`);
  }
  assertTheme(theme);
}

export type ThemeId = keyof typeof themes;

export const DEFAULT_THEME_ID = "26-basic" satisfies ThemeId;

export function isThemeId(value: string): value is ThemeId {
  return Object.hasOwn(themes, value);
}

function themeBlock(selector: string, theme: PartyTheme): string {
  const colours = paletteRoles.map(
    (role) => `    ${paletteVariable(role)}: ${theme.colors[role]};`,
  );
  return `  ${selector} {\n    color-scheme: ${theme.colorScheme};\n${colours.join("\n")}\n  }`;
}

export function themeDocumentHead(): { style: string; themeColor: string } {
  const fallback = themes[DEFAULT_THEME_ID];
  const themed = Object.values(themes).map((theme) =>
    themeBlock(`[data-theme="${theme.id}"]`, theme),
  );
  return {
    style: `${themeBlock(":root", fallback)}\n${themed.join("\n")}`,
    themeColor: fallback.colors.background,
  };
}
