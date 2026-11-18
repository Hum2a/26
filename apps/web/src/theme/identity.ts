import { deepSkinFor, type DeepSkin } from "./deep-skins";
import { skinFor, type ThemeSkin } from "./skins";
import type { ThemeId } from "./themes";

/**
 * A theme's whole identity: its family skin and deep layer, then the theme's
 * own flavour on top. The flavour may override any family value (a different
 * scene, type or panel) and must choose every theme-level dimension below, so
 * no two themes in one family feel the same. Colours stay in themes.ts.
 *
 * - marks: how answer options are lettered on phones and the projector.
 * - celebrate: the burst when a guest scores and when the projector reveals.
 * - transition: how one phase hands over to the next.
 * - numerals: how scores, timers and counts are set.
 * - ornament: the small glyph before cues and eyebrow labels.
 * - strength: how strongly the background scene shows.
 *
 * `identity.test.ts` requires every pair of themes to differ in several of
 * these, so a new theme cannot be a recolour of an old one.
 */

export const markStyles = [
  "classic",
  "alpha",
  "lower",
  "roman",
  "numeric",
  "circled",
  "buttons",
  "suits",
  "greek",
  "kana",
  "binary",
  "dice",
  "fkeys",
  "players",
] as const;

export const celebrations = [
  "confetti",
  "sparks",
  "stars",
  "petals",
  "pixels",
  "bubbles",
  "hearts",
  "leaves",
  "coins",
  "notes",
  "embers",
  "bolts",
  "snow",
  "balloons",
  "butterflies",
  "cards",
  "rings",
] as const;

export const transitions = [
  "rise",
  "fade",
  "slide",
  "wipe",
  "iris",
  "zoom",
  "flip",
  "glitch",
  "drop",
  "skew",
  "blur",
  "shutter",
] as const;

export const numeralStyles = [
  "plain",
  "tabular",
  "segment",
  "serif",
  "outline",
  "stamped",
] as const;

/** Each ornament's glyph. Text symbols only: colour emoji would ignore the theme. */
export const ornamentGlyphs = {
  none: "",
  spark: "✦",
  slashes: "//",
  chevron: "»",
  star: "★",
  diamond: "◆",
  dot: "●",
  hash: "#",
  section: "§",
  prompt: ">_",
  plus: "+",
  asterisk: "✱",
  moon: "☾",
  heart: "♡",
  bolt: "ϟ",
  leaf: "❦",
  flower: "✿",
  note: "♪",
  cross: "✕",
  triangle: "▲",
  square: "■",
  wave: "≈",
  arrow: "→",
  quote: "❝",
  dollar: "$",
  flag: "⚑",
  target: "◎",
  crown: "♛",
  exclaim: "!!",
  pencil: "✎",
  check: "✓",
} as const;

export const sceneStrengths = ["faint", "normal", "bold"] as const;

export type MarkStyle = (typeof markStyles)[number];
export type Celebration = (typeof celebrations)[number];
export type PhaseMotion = (typeof transitions)[number];
export type NumeralStyle = (typeof numeralStyles)[number];
export type Ornament = keyof typeof ornamentGlyphs;
export type SceneStrength = (typeof sceneStrengths)[number];

type FamilyValues = Omit<ThemeSkin, "id" | "motif" | "icon"> & DeepSkin;

export type ThemeFlavour = Partial<FamilyValues> & {
  marks: MarkStyle;
  celebrate: Celebration;
  transition: PhaseMotion;
  numerals: NumeralStyle;
  ornament: Ornament;
  strength: SceneStrength;
};

export type ThemeIdentity = ThemeSkin &
  DeepSkin & {
    marks: MarkStyle;
    celebrate: Celebration;
    transition: PhaseMotion;
    numerals: NumeralStyle;
    ornament: Ornament;
    strength: SceneStrength;
  };

/**
 * Every theme's flavour. `Record<ThemeId, …>` makes a new theme fail the
 * typecheck until it has one.
 */
const flavours: Record<ThemeId, ThemeFlavour> = {
  // The plain party look: today's chrome, unchanged.
  "26-basic": {
    marks: "classic",
    celebrate: "confetti",
    transition: "rise",
    numerals: "plain",
    ornament: "none",
    strength: "normal",
  },

  // Personal to 26
  "version-26": {
    scene: "circuit",
    type: "grotesk",
    control: "pill-glass",
    panel: "glass",
    heading: "gradient",
    motion: "cinematic",
    marks: "numeric",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "tabular",
    ornament: "chevron",
    strength: "normal",
  },
  "humza-after-hours": {
    scene: "skyline",
    marks: "lower",
    celebrate: "stars",
    transition: "blur",
    numerals: "serif",
    ornament: "moon",
    strength: "bold",
  },
  "humza-os": {
    marks: "fkeys",
    celebrate: "pixels",
    transition: "glitch",
    numerals: "segment",
    ornament: "prompt",
    strength: "normal",
  },
  "main-character": {
    type: "serif",
    heading: "shadow-stack",
    marks: "circled",
    celebrate: "stars",
    transition: "iris",
    numerals: "outline",
    ornament: "crown",
    strength: "bold",
  },
  "baseer-live": {
    marks: "numeric",
    celebrate: "notes",
    transition: "slide",
    numerals: "segment",
    ornament: "dot",
    strength: "normal",
  },
  "26-karat": {
    marks: "roman",
    celebrate: "coins",
    transition: "zoom",
    numerals: "serif",
    ornament: "diamond",
    strength: "normal",
  },
  "november-nights": {
    scene: "fireworks",
    marks: "lower",
    celebrate: "sparks",
    transition: "fade",
    numerals: "plain",
    ornament: "spark",
    strength: "normal",
  },
  "birthday-exe": {
    scene: "popups",
    texture: "scanlines",
    control: "hard-shadow",
    marks: "binary",
    celebrate: "balloons",
    transition: "shutter",
    numerals: "tabular",
    ornament: "hash",
    strength: "normal",
  },
  "the-humza-show": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "flip",
    numerals: "outline",
    ornament: "star",
    strength: "normal",
  },
  "quarter-life-deluxe": {
    scene: "sparkles",
    marks: "circled",
    celebrate: "balloons",
    transition: "drop",
    numerals: "outline",
    ornament: "plus",
    strength: "normal",
  },

  // Quiz and chaos
  "friendly-sabotage": {
    scene: "dice",
    marks: "dice",
    celebrate: "bolts",
    transition: "skew",
    numerals: "stamped",
    ornament: "cross",
    strength: "normal",
  },
  "final-answer": {
    scene: "clocks",
    texture: "vignette",
    panel: "double",
    heading: "glow",
    motion: "cinematic",
    marks: "alpha",
    celebrate: "rings",
    transition: "iris",
    numerals: "tabular",
    ornament: "diamond",
    strength: "normal",
  },
  "big-red-button": {
    scene: "alarm",
    marks: "numeric",
    celebrate: "sparks",
    transition: "glitch",
    numerals: "stamped",
    ornament: "triangle",
    strength: "bold",
  },
  "high-score-club": {
    scene: "pixels",
    type: "condensed",
    texture: "scanlines",
    control: "hard-shadow",
    marks: "circled",
    celebrate: "pixels",
    transition: "shutter",
    numerals: "segment",
    ornament: "square",
    strength: "normal",
  },
  "plot-twist": {
    scene: "questions",
    marks: "lower",
    celebrate: "cards",
    transition: "flip",
    numerals: "plain",
    ornament: "asterisk",
    strength: "normal",
  },
  "steal-the-spotlight": {
    scene: "spotlights",
    marks: "alpha",
    celebrate: "stars",
    transition: "iris",
    numerals: "outline",
    ornament: "star",
    strength: "bold",
  },
  "confetti-department": {
    type: "rounded",
    control: "hard-shadow",
    heading: "highlighter",
    scene: "confetti",
    marks: "circled",
    celebrate: "confetti",
    transition: "drop",
    numerals: "tabular",
    ornament: "flower",
    strength: "normal",
  },

  // Dark and atmospheric
  "midnight-matcha": {
    scene: "ripples",
    type: "serif",
    control: "pill-glass",
    panel: "glass",
    heading: "plain",
    marks: "kana",
    celebrate: "leaves",
    transition: "blur",
    numerals: "serif",
    ornament: "leaf",
    strength: "normal",
  },
  "petrol-and-peach": {
    scene: "rain",
    marks: "numeric",
    celebrate: "sparks",
    transition: "slide",
    numerals: "segment",
    ornament: "bolt",
    strength: "normal",
  },
  ultraviolet: {
    scene: "aurora",
    texture: "holo",
    marks: "greek",
    celebrate: "rings",
    transition: "blur",
    numerals: "outline",
    ornament: "diamond",
    strength: "bold",
  },

  // Light and nostalgic
  "pistachio-party": {
    scene: "bubbles",
    marks: "lower",
    celebrate: "petals",
    transition: "drop",
    numerals: "plain",
    ornament: "dot",
    strength: "normal",
  },
  "peach-please": {
    scene: "hearts",
    marks: "circled",
    celebrate: "hearts",
    transition: "zoom",
    numerals: "serif",
    ornament: "heart",
    strength: "normal",
  },
  "blue-hour": {
    marks: "lower",
    celebrate: "snow",
    transition: "blur",
    numerals: "plain",
    ornament: "moon",
    strength: "normal",
  },
  "retro-future": {
    marks: "numeric",
    celebrate: "rings",
    transition: "shutter",
    numerals: "segment",
    ornament: "chevron",
    strength: "normal",
  },
  "poolside-2000": {
    scene: "waves",
    marks: "lower",
    celebrate: "bubbles",
    transition: "slide",
    numerals: "tabular",
    ornament: "wave",
    strength: "normal",
  },
  "paper-party": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "flip",
    numerals: "stamped",
    ornament: "pencil",
    strength: "normal",
  },
  "lavender-menace": {
    scene: "petals",
    marks: "greek",
    celebrate: "butterflies",
    transition: "blur",
    numerals: "serif",
    ornament: "asterisk",
    strength: "normal",
  },

  // Personal to the night
  "humza-studio": {
    scene: "filmstrip",
    type: "grotesk",
    marks: "numeric",
    celebrate: "stars",
    transition: "wipe",
    numerals: "tabular",
    ornament: "square",
    strength: "normal",
  },
  "humza-according-to-everyone": {
    scene: "chatter",
    marks: "circled",
    celebrate: "hearts",
    transition: "slide",
    numerals: "plain",
    ornament: "quote",
    strength: "normal",
  },
  "the-humza-archives": {
    scene: "polaroids",
    marks: "roman",
    celebrate: "cards",
    transition: "flip",
    numerals: "stamped",
    ornament: "section",
    strength: "normal",
  },
  "21-november": {
    texture: "holo",
    heading: "gradient",
    scene: "balloons",
    marks: "numeric",
    celebrate: "balloons",
    transition: "drop",
    numerals: "outline",
    ornament: "star",
    strength: "normal",
  },

  // Persona
  "persona-1-origins": {
    scene: "butterflies",
    type: "serif",
    texture: "grain",
    marks: "roman",
    celebrate: "butterflies",
    transition: "iris",
    numerals: "serif",
    ornament: "diamond",
    strength: "normal",
  },
  "persona-2-innocent-birthday": {
    scene: "embers",
    marks: "circled",
    celebrate: "embers",
    transition: "wipe",
    numerals: "outline",
    ornament: "spark",
    strength: "normal",
  },
  "persona-3-midnight-hour": {
    scene: "moon",
    marks: "roman",
    celebrate: "rings",
    transition: "glitch",
    numerals: "segment",
    ornament: "moon",
    strength: "bold",
  },
  "persona-3-portable-pink-route": {
    scene: "petals",
    marks: "lower",
    celebrate: "hearts",
    transition: "zoom",
    numerals: "tabular",
    ornament: "heart",
    strength: "normal",
  },
  "persona-4-golden-hour": {
    scene: "static",
    texture: "scanlines",
    marks: "alpha",
    celebrate: "stars",
    transition: "shutter",
    numerals: "tabular",
    ornament: "chevron",
    strength: "faint",
  },
  "persona-5-take-your-time": {
    marks: "suits",
    celebrate: "cards",
    transition: "skew",
    numerals: "stamped",
    ornament: "star",
    strength: "normal",
  },
  "the-velvet-room": {
    scene: "curtains",
    marks: "roman",
    celebrate: "cards",
    transition: "iris",
    numerals: "serif",
    ornament: "diamond",
    strength: "normal",
  },
  "cafe-leblanc": {
    scene: "rain",
    type: "serif",
    panel: "card",
    marks: "lower",
    celebrate: "notes",
    transition: "fade",
    numerals: "serif",
    ornament: "dot",
    strength: "faint",
  },

  // Games
  "final-fantasy-crystal-prelude": {
    type: "serif",
    panel: "double",
    heading: "shadow-stack",
    scene: "crystals",
    marks: "roman",
    celebrate: "stars",
    transition: "blur",
    numerals: "serif",
    ornament: "diamond",
    strength: "normal",
  },
  "final-fantasy-vii-mako": {
    scene: "streams",
    marks: "numeric",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "segment",
    ornament: "triangle",
    strength: "normal",
  },
  "pokemon-pallet-town": {
    scene: "grass",
    marks: "alpha",
    celebrate: "stars",
    transition: "wipe",
    numerals: "tabular",
    ornament: "dot",
    strength: "normal",
  },
  "pokemon-gengar-hours": {
    scene: "ghosts",
    marks: "lower",
    celebrate: "embers",
    transition: "blur",
    numerals: "outline",
    ornament: "cross",
    strength: "normal",
  },
  "smash-final-destination": {
    scene: "stars",
    marks: "players",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "outline",
    ornament: "plus",
    strength: "normal",
  },
  "scarlet-nexus-brain-drive": {
    scene: "hexes",
    type: "condensed",
    control: "slant",
    marks: "circled",
    celebrate: "bolts",
    transition: "glitch",
    numerals: "segment",
    ornament: "slashes",
    strength: "normal",
  },
  "gta-vi-vice-birthday": {
    marks: "alpha",
    celebrate: "coins",
    transition: "wipe",
    numerals: "segment",
    ornament: "chevron",
    strength: "normal",
  },
  "ps2-memory-card": {
    marks: "buttons",
    celebrate: "stars",
    transition: "blur",
    numerals: "tabular",
    ornament: "square",
    strength: "normal",
  },

  // Anime
  "dragon-ball-birthday-saiyan": {
    scene: "aura",
    type: "condensed",
    heading: "shadow-stack",
    marks: "circled",
    celebrate: "bolts",
    transition: "zoom",
    numerals: "outline",
    ornament: "bolt",
    strength: "bold",
  },
  "dragon-ball-capsule-corp": {
    scene: "capsules",
    marks: "numeric",
    celebrate: "rings",
    transition: "drop",
    numerals: "tabular",
    ornament: "plus",
    strength: "normal",
  },
  "my-hero-academia-plus-ultra": {
    heading: "highlighter",
    marks: "numeric",
    celebrate: "sparks",
    transition: "skew",
    numerals: "outline",
    ornament: "plus",
    strength: "normal",
  },
  "naruto-hidden-leaf": {
    type: "condensed",
    motion: "snappy",
    heading: "underline",
    scene: "leaves",
    marks: "kana",
    celebrate: "leaves",
    transition: "blur",
    numerals: "plain",
    ornament: "leaf",
    strength: "normal",
  },
  "bunny-girl-senpai-after-school": {
    scene: "petals",
    marks: "lower",
    celebrate: "petals",
    transition: "fade",
    numerals: "serif",
    ornament: "spark",
    strength: "normal",
  },
  "tsukigakirei-moonlit-walk": {
    type: "serif",
    texture: "vignette",
    heading: "glow",
    scene: "fireflies",
    marks: "kana",
    celebrate: "embers",
    transition: "blur",
    numerals: "serif",
    ornament: "moon",
    strength: "normal",
  },
  "your-name-twilight-thread": {
    heading: "gradient",
    motion: "cinematic",
    scene: "comets",
    marks: "kana",
    celebrate: "sparks",
    transition: "wipe",
    numerals: "plain",
    ornament: "wave",
    strength: "normal",
  },
  "fullmetal-alchemist-equivalent-exchange": {
    scene: "circles",
    marks: "greek",
    celebrate: "sparks",
    transition: "iris",
    numerals: "serif",
    ornament: "triangle",
    strength: "normal",
  },
  "keijo-absolutely-necessary": {
    control: "pill-glass",
    panel: "glass",
    scene: "speedlines",
    marks: "numeric",
    celebrate: "bubbles",
    transition: "skew",
    numerals: "stamped",
    ornament: "exclaim",
    strength: "normal",
  },

  // Everyday
  "chinese-takeaway-at-humzas": {
    panel: "receipt",
    heading: "stamp",
    scene: "lanterns",
    marks: "numeric",
    celebrate: "confetti",
    transition: "slide",
    numerals: "stamped",
    ornament: "hash",
    strength: "normal",
  },
  "tea-obviously": {
    scene: "steam",
    type: "serif",
    marks: "lower",
    celebrate: "leaves",
    transition: "drop",
    numerals: "serif",
    ornament: "leaf",
    strength: "normal",
  },
  "rum-and-coke": {
    marks: "alpha",
    celebrate: "bubbles",
    transition: "slide",
    numerals: "tabular",
    ornament: "dot",
    strength: "normal",
  },
  "usual-table-laptop-open": {
    scene: "windows",
    type: "grotesk",
    texture: "grain",
    marks: "lower",
    celebrate: "rings",
    transition: "slide",
    numerals: "tabular",
    ornament: "prompt",
    strength: "normal",
  },

  // Cars
  "nissan-leaf": {
    marks: "numeric",
    celebrate: "leaves",
    transition: "slide",
    numerals: "segment",
    ornament: "bolt",
    strength: "normal",
  },
  "toyota-prius-plus": {
    scene: "clouds",
    marks: "alpha",
    celebrate: "rings",
    transition: "fade",
    numerals: "tabular",
    ornament: "plus",
    strength: "normal",
  },

  // School
  "wallington-grammar-school-arc": {
    marks: "alpha",
    celebrate: "stars",
    transition: "flip",
    numerals: "serif",
    ornament: "check",
    strength: "normal",
  },
  "greenshaw-next-chapter": {
    scene: "chalk",
    marks: "numeric",
    celebrate: "confetti",
    transition: "wipe",
    numerals: "plain",
    ornament: "chevron",
    strength: "normal",
  },
  "portsmouth-student-save-file": {
    scene: "pixels",
    type: "mono",
    marks: "fkeys",
    celebrate: "coins",
    transition: "shutter",
    numerals: "segment",
    ornament: "hash",
    strength: "normal",
  },

  // Work
  "amazon-out-for-delivery": {
    scene: "parcels",
    marks: "numeric",
    celebrate: "confetti",
    transition: "slide",
    numerals: "stamped",
    ornament: "arrow",
    strength: "normal",
  },
  "mchumza-birthday-meal": {
    type: "rounded",
    marks: "numeric",
    celebrate: "balloons",
    transition: "drop",
    numerals: "segment",
    ornament: "star",
    strength: "normal",
  },
  "spoon-world-portsmouth-edition": {
    marks: "numeric",
    celebrate: "coins",
    transition: "fade",
    numerals: "stamped",
    ornament: "dot",
    strength: "normal",
  },
  "fratton-park-matchday-shift": {
    marks: "numeric",
    celebrate: "confetti",
    transition: "wipe",
    numerals: "segment",
    ornament: "dot",
    strength: "normal",
  },
  "stamford-bridge-on-the-clock": {
    heading: "glow",
    marks: "circled",
    celebrate: "stars",
    transition: "slide",
    numerals: "tabular",
    ornament: "chevron",
    strength: "normal",
  },
  "goodwood-all-access": {
    scene: "chequered",
    marks: "numeric",
    celebrate: "sparks",
    transition: "skew",
    numerals: "outline",
    ornament: "flag",
    strength: "normal",
  },
  "queens-centre-court": {
    scene: "court",
    type: "serif",
    control: "pill-glass",
    marks: "alpha",
    celebrate: "rings",
    transition: "slide",
    numerals: "serif",
    ornament: "dot",
    strength: "normal",
  },
  "twickenham-under-the-floodlights": {
    marks: "circled",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "stamped",
    ornament: "cross",
    strength: "normal",
  },
  "corestream-risk-accepted": {
    scene: "chart",
    marks: "alpha",
    celebrate: "rings",
    transition: "wipe",
    numerals: "tabular",
    ornament: "arrow",
    strength: "normal",
  },
  "501-fun-maximum-fun": {
    scene: "dartboard",
    marks: "numeric",
    celebrate: "rings",
    transition: "zoom",
    numerals: "segment",
    ornament: "target",
    strength: "normal",
  },

  // Musicians
  "pitbull-mr-worldwide": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "zoom",
    numerals: "outline",
    ornament: "arrow",
    strength: "normal",
  },
  "bbno-birthday-budget": {
    heading: "highlighter",
    texture: "halftone",
    scene: "coins",
    marks: "lower",
    celebrate: "coins",
    transition: "slide",
    numerals: "tabular",
    ornament: "dollar",
    strength: "normal",
  },
  "yung-gravy-gravy-boat": {
    scene: "drips",
    marks: "lower",
    celebrate: "hearts",
    transition: "blur",
    numerals: "serif",
    ornament: "wave",
    strength: "normal",
  },
  "rick-astley-never-gonna-log-you-out": {
    scene: "vinyl",
    marks: "alpha",
    celebrate: "notes",
    transition: "slide",
    numerals: "plain",
    ornament: "note",
    strength: "normal",
  },
};

const resolved = new Map<ThemeId, ThemeIdentity>();

/** One stable object per theme, so components can compare identities cheaply. */
export function identityFor(id: ThemeId): ThemeIdentity {
  const cached = resolved.get(id);
  if (cached) return cached;
  const skin = skinFor(id);
  const flavour = flavours[id];
  const identity = { ...skin, ...deepSkinFor(skin), ...flavour } as ThemeIdentity;
  resolved.set(id, identity);
  return identity;
}

/** The dimensions a guest can see change from theme to theme. */
export const identityDimensions = [
  "ground",
  "shape",
  "mark",
  "finish",
  "type",
  "scene",
  "texture",
  "control",
  "panel",
  "heading",
  "motion",
  "align",
  "marks",
  "celebrate",
  "transition",
  "numerals",
  "ornament",
  "strength",
] as const satisfies readonly (keyof ThemeIdentity)[];

/** Kahoot-style shapes on the phone; the projector letters them A, B, C. */
const classicShapes = ["▲", "◆", "●", "■", "★", "⬢"] as const;

/** Text presentation, so a suit, die or circled Ⓜ never turns into a colour emoji. */
const text = (symbol: string) => `${symbol}︎`;

const markSets: Record<Exclude<MarkStyle, "classic">, readonly string[]> = {
  alpha: [..."ABCDEFGHIJKLMNOP"],
  lower: [..."abcdefghijklmnop"],
  roman: [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
  ],
  numeric: Array.from({ length: 16 }, (_, index) => String(index + 1)),
  circled: [..."ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅ"].map(text),
  buttons: ["△", "○", "✕", "□"],
  suits: ["♠", "♥", "♦", "♣"].map(text),
  greek: [..."αβγδεζηθικλμνξοπ"],
  kana: [..."あいうえおかきくけこさしすせそた"],
  binary: Array.from({ length: 16 }, (_, index) => index.toString(2).padStart(2, "0")),
  dice: ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"].map(text),
  fkeys: Array.from({ length: 16 }, (_, index) => `F${index + 1}`),
  players: Array.from({ length: 16 }, (_, index) => `P${index + 1}`),
};

/**
 * The mark beside answer option `index`. "classic" keeps the original pair:
 * shapes on the phone, letters on the projector. Every other style is the same
 * on both, so a guest can match their phone to the big screen. A short set
 * (four suits, six dice) continues with numbers.
 */
export function optionMark(
  style: MarkStyle,
  index: number,
  surface: "phone" | "stage",
): string {
  if (style === "classic") {
    return surface === "phone"
      ? classicShapes[index % classicShapes.length]!
      : (markSets.alpha[index] ?? "•");
  }
  return markSets[style][index] ?? String(index + 1);
}

export const themeIdsWithFlavour = Object.keys(flavours) as ThemeId[];
