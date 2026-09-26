import type { ThemeId } from "./themes";

/**
 * Optional identity on top of a palette. Colours stay in themes.ts.
 * A theme with no entry here keeps the plain party chrome.
 */

export const skinGrounds = [
  "flat",
  "slash",
  "split",
  "stripes",
  "grid",
  "tiles",
  "sunset",
] as const;

export const skinShapes = ["round", "sharp", "chunky", "soft", "ticket", "cut"] as const;

export const skinMarks = [
  "numeral",
  "mask",
  "card",
  "cup",
  "shades",
  "spoon",
  "skyline",
] as const;

export type SkinGround = (typeof skinGrounds)[number];
export type SkinShape = (typeof skinShapes)[number];
export type SkinMark = (typeof skinMarks)[number];

export type ThemeSkin = {
  id: string;
  ground: SkinGround;
  shape: SkinShape;
  mark: SkinMark;
};

export const plainSkin: ThemeSkin = {
  id: "plain",
  ground: "flat",
  shape: "round",
  mark: "numeral",
};

const skinned: Partial<Record<ThemeId, ThemeSkin>> = {
  "persona-5-take-your-time": {
    id: "persona-5",
    ground: "slash",
    shape: "sharp",
    mark: "mask",
  },
  "ps2-memory-card": {
    id: "ps2",
    ground: "grid",
    shape: "chunky",
    mark: "card",
  },
  "cafe-leblanc-but-make-it-tea": {
    id: "leblanc-tea",
    ground: "split",
    shape: "soft",
    mark: "cup",
  },
  "pitbull-mr-worldwide": {
    id: "pitbull",
    ground: "stripes",
    shape: "round",
    mark: "shades",
  },
  "spoon-world-portsmouth-edition": {
    id: "spoon-world",
    ground: "tiles",
    shape: "ticket",
    mark: "spoon",
  },
  "gta-vi-vice-birthday": {
    id: "vice",
    ground: "sunset",
    shape: "cut",
    mark: "skyline",
  },
};

export function skinFor(id: ThemeId): ThemeSkin {
  return skinned[id] ?? plainSkin;
}

export const skinnedThemeIds = Object.keys(skinned) as ThemeId[];
