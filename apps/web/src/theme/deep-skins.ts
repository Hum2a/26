import type { ThemeSkin } from "./skins";

/**
 * The deep layer of a skin: how a family looks and moves beyond its ground,
 * corners and mark. Every value is drawn in `theme-deep.css` from the theme's
 * own colour variables. Nothing here introduces a colour.
 *
 * - type: the typefaces and heading case.
 * - scene: an illustrated background behind the page (never on a question).
 * - texture: a faint full-screen overlay, like a shader (grain, scanlines).
 * - control / panel: the shape, edges and lighting of buttons and cards.
 * - heading: how question and page titles are dressed.
 * - motion: the easing curve and how panels arrive.
 * - align: where headings sit.
 * Scenes and textures may move slowly; reduced motion stops them. Controls
 * never loop.
 */
export const deepTypes = ["grotesk", "serif", "mono", "condensed", "rounded", "slab", "italic"] as const;
export const deepScenes = [
  "none",
  "spotlights",
  "stars",
  "code",
  "equaliser",
  "sunburst",
  "confetti",
  "doodles",
  "lasers",
  "hills",
  "synthgrid",
  "palms",
  "notebook",
  "speedlines",
  "shards",
  "cubes",
  "road",
  "receipts",
  "pub",
  "pitch",
  "globe",
] as const;
export const deepTextures = ["none", "grain", "scanlines", "crt", "halftone", "vignette", "holo"] as const;
export const deepControls = [
  "solid",
  "neon",
  "bevel",
  "hard-shadow",
  "slant",
  "bracket",
  "scoreboard",
  "stamp",
  "pill-glass",
] as const;
export const deepPanels = [
  "card",
  "glass",
  "double",
  "taped",
  "terminal",
  "tilted",
  "receipt",
  "notebook",
  "jagged",
  "scoreboard",
  "polaroid",
] as const;
export const deepHeadings = [
  "plain",
  "shadow-stack",
  "glow",
  "gradient",
  "highlighter",
  "prompt",
  "ransom",
  "stamp",
  "marquee",
  "underline",
] as const;
export const deepMotions = ["smooth", "snappy", "springy", "floaty", "glitchy", "cinematic", "mechanical"] as const;

export type DeepSkin = {
  type: (typeof deepTypes)[number];
  scene: (typeof deepScenes)[number];
  texture: (typeof deepTextures)[number];
  control: (typeof deepControls)[number];
  panel: (typeof deepPanels)[number];
  heading: (typeof deepHeadings)[number];
  motion: (typeof deepMotions)[number];
  align: "left" | "center";
};

/** 26 basic: the plain chrome, unchanged. */
export const plainDeep: DeepSkin = {
  type: "grotesk",
  scene: "none",
  texture: "none",
  control: "solid",
  panel: "card",
  heading: "plain",
  motion: "smooth",
  align: "left",
};

/** By skin family id. A family missing here uses the plain deep layer. */
const deep: Record<string, DeepSkin> = {
  // A TV game show: spotlights, marquee bulbs, big condensed type.
  show: {
    type: "condensed",
    scene: "spotlights",
    texture: "vignette",
    control: "bevel",
    panel: "double",
    heading: "marquee",
    motion: "springy",
    align: "center",
  },
  // Late, soft and atmospheric: stars, glass and a serif.
  glow: {
    type: "serif",
    scene: "stars",
    texture: "grain",
    control: "neon",
    panel: "glass",
    heading: "glow",
    motion: "floaty",
    align: "center",
  },
  // A terminal: falling code, scanlines, mono type and a prompt.
  crt: {
    type: "mono",
    scene: "code",
    texture: "crt",
    control: "bracket",
    panel: "terminal",
    heading: "prompt",
    motion: "glitchy",
    align: "left",
  },
  // A live show: an equaliser and a broadcast look.
  mic: {
    type: "condensed",
    scene: "equaliser",
    texture: "vignette",
    control: "neon",
    panel: "glass",
    heading: "highlighter",
    motion: "snappy",
    align: "center",
  },
  // Gold and foil: a slow sunburst, holographic sheen and a gradient title.
  foil: {
    type: "serif",
    scene: "sunburst",
    texture: "holo",
    control: "bevel",
    panel: "double",
    heading: "gradient",
    motion: "cinematic",
    align: "center",
  },
  // Quiz chaos: confetti, halftone and hard cartoon shadows.
  tape: {
    type: "condensed",
    scene: "confetti",
    texture: "halftone",
    control: "hard-shadow",
    panel: "taped",
    heading: "highlighter",
    motion: "springy",
    align: "left",
  },
  // Made by hand: doodles, paper grain and polaroids.
  paper: {
    type: "slab",
    scene: "doodles",
    texture: "grain",
    control: "hard-shadow",
    panel: "polaroid",
    heading: "underline",
    motion: "floaty",
    align: "left",
  },
  // A club: lasers, glass and neon.
  club: {
    type: "grotesk",
    scene: "lasers",
    texture: "grain",
    control: "neon",
    panel: "glass",
    heading: "glow",
    motion: "springy",
    align: "center",
  },
  // A landscape: hills, a sun and drifting clouds.
  horizon: {
    type: "rounded",
    scene: "hills",
    texture: "grain",
    control: "pill-glass",
    panel: "glass",
    heading: "plain",
    motion: "floaty",
    align: "center",
  },
  // Synthwave: a moving grid floor under a striped sun.
  sunset: {
    type: "italic",
    scene: "synthgrid",
    texture: "scanlines",
    control: "slant",
    panel: "glass",
    heading: "gradient",
    motion: "cinematic",
    align: "center",
  },
  // Vice City: palms against the sunset grid.
  vice: {
    type: "italic",
    scene: "palms",
    texture: "scanlines",
    control: "neon",
    panel: "glass",
    heading: "gradient",
    motion: "cinematic",
    align: "center",
  },
  // School: a notebook with a margin and ruled lines.
  ruled: {
    type: "slab",
    scene: "notebook",
    texture: "grain",
    control: "stamp",
    panel: "notebook",
    heading: "underline",
    motion: "mechanical",
    align: "left",
  },
  // Action anime: speed lines and slanted everything.
  slash: {
    type: "italic",
    scene: "speedlines",
    texture: "halftone",
    control: "slant",
    panel: "tilted",
    heading: "shadow-stack",
    motion: "snappy",
    align: "left",
  },
  // Persona 5: red shards and ransom-note titles.
  "persona-5": {
    type: "condensed",
    scene: "shards",
    texture: "halftone",
    control: "slant",
    panel: "jagged",
    heading: "ransom",
    motion: "glitchy",
    align: "left",
  },
  // PS2: floating translucent cubes from the boot screen.
  ps2: {
    type: "grotesk",
    scene: "cubes",
    texture: "scanlines",
    control: "pill-glass",
    panel: "glass",
    heading: "glow",
    motion: "floaty",
    align: "center",
  },
  // Electric car: a road with a moving centre line.
  leaf: {
    type: "rounded",
    scene: "road",
    texture: "none",
    control: "pill-glass",
    panel: "card",
    heading: "plain",
    motion: "smooth",
    align: "center",
  },
  prius: {
    type: "rounded",
    scene: "road",
    texture: "grain",
    control: "pill-glass",
    panel: "glass",
    heading: "plain",
    motion: "smooth",
    align: "center",
  },
  // Shift work: receipts, barcodes and stamps.
  service: {
    type: "mono",
    scene: "receipts",
    texture: "grain",
    control: "stamp",
    panel: "receipt",
    heading: "stamp",
    motion: "mechanical",
    align: "left",
  },
  // A pub: wood panels and warm lamps.
  "spoon-world": {
    type: "slab",
    scene: "pub",
    texture: "vignette",
    control: "bevel",
    panel: "double",
    heading: "stamp",
    motion: "cinematic",
    align: "center",
  },
  // A stadium: pitch markings and floodlights; scoreboard type.
  floodlight: {
    type: "condensed",
    scene: "pitch",
    texture: "grain",
    control: "scoreboard",
    panel: "scoreboard",
    heading: "highlighter",
    motion: "snappy",
    align: "left",
  },
  // Mr Worldwide: a spinning globe and disco light.
  pitbull: {
    type: "condensed",
    scene: "globe",
    texture: "vignette",
    control: "neon",
    panel: "glass",
    heading: "gradient",
    motion: "springy",
    align: "center",
  },
};

export function deepSkinFor(skin: Pick<ThemeSkin, "id">): DeepSkin {
  return deep[skin.id] ?? plainDeep;
}

export const deepFamilies = Object.keys(deep);
