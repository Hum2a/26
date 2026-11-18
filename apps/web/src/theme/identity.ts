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
  strength?: SceneStrength;
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
  },
  "26-karat": {
    marks: "roman",
    celebrate: "coins",
    transition: "zoom",
    numerals: "serif",
    ornament: "diamond",
  },
  "november-nights": {
    scene: "fireworks",
    marks: "lower",
    celebrate: "sparks",
    transition: "fade",
    numerals: "plain",
    ornament: "spark",
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
  },
  "the-humza-show": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "flip",
    numerals: "outline",
    ornament: "star",
  },
  "quarter-life-deluxe": {
    scene: "sparkles",
    marks: "circled",
    celebrate: "balloons",
    transition: "drop",
    numerals: "outline",
    ornament: "plus",
  },

  // Quiz and chaos
  "friendly-sabotage": {
    scene: "dice",
    marks: "dice",
    celebrate: "bolts",
    transition: "skew",
    numerals: "stamped",
    ornament: "cross",
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
  },
  "plot-twist": {
    scene: "questions",
    marks: "lower",
    celebrate: "cards",
    transition: "flip",
    numerals: "plain",
    ornament: "asterisk",
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
  },
  "petrol-and-peach": {
    scene: "rain",
    marks: "numeric",
    celebrate: "sparks",
    transition: "slide",
    numerals: "segment",
    ornament: "bolt",
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
  },
  "peach-please": {
    scene: "hearts",
    marks: "circled",
    celebrate: "hearts",
    transition: "zoom",
    numerals: "serif",
    ornament: "heart",
  },
  "blue-hour": {
    marks: "lower",
    celebrate: "snow",
    transition: "blur",
    numerals: "plain",
    ornament: "moon",
  },
  "retro-future": {
    marks: "numeric",
    celebrate: "rings",
    transition: "shutter",
    numerals: "segment",
    ornament: "chevron",
  },
  "poolside-2000": {
    scene: "waves",
    marks: "lower",
    celebrate: "bubbles",
    transition: "slide",
    numerals: "tabular",
    ornament: "wave",
  },
  "paper-party": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "flip",
    numerals: "stamped",
    ornament: "pencil",
  },
  "lavender-menace": {
    scene: "petals",
    marks: "greek",
    celebrate: "butterflies",
    transition: "blur",
    numerals: "serif",
    ornament: "asterisk",
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
  },
  "humza-according-to-everyone": {
    scene: "chatter",
    marks: "circled",
    celebrate: "hearts",
    transition: "slide",
    numerals: "plain",
    ornament: "quote",
  },
  "the-humza-archives": {
    scene: "polaroids",
    marks: "roman",
    celebrate: "cards",
    transition: "flip",
    numerals: "stamped",
    ornament: "section",
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
  },
  "persona-2-innocent-birthday": {
    scene: "embers",
    marks: "circled",
    celebrate: "embers",
    transition: "wipe",
    numerals: "outline",
    ornament: "spark",
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
  },
  "the-velvet-room": {
    scene: "curtains",
    marks: "roman",
    celebrate: "cards",
    transition: "iris",
    numerals: "serif",
    ornament: "diamond",
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
  },
  "final-fantasy-vii-mako": {
    scene: "streams",
    marks: "numeric",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "segment",
    ornament: "triangle",
  },
  "pokemon-pallet-town": {
    scene: "grass",
    marks: "alpha",
    celebrate: "stars",
    transition: "wipe",
    numerals: "tabular",
    ornament: "dot",
  },
  "pokemon-gengar-hours": {
    scene: "ghosts",
    marks: "lower",
    celebrate: "embers",
    transition: "blur",
    numerals: "outline",
    ornament: "cross",
  },
  "smash-final-destination": {
    scene: "stars",
    marks: "players",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "outline",
    ornament: "plus",
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
  },
  "gta-vi-vice-birthday": {
    marks: "alpha",
    celebrate: "coins",
    transition: "wipe",
    numerals: "segment",
    ornament: "chevron",
  },
  "ps2-memory-card": {
    marks: "buttons",
    celebrate: "stars",
    transition: "blur",
    numerals: "tabular",
    ornament: "square",
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
  },
  "my-hero-academia-plus-ultra": {
    heading: "highlighter",
    marks: "numeric",
    celebrate: "sparks",
    transition: "skew",
    numerals: "outline",
    ornament: "plus",
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
  },
  "bunny-girl-senpai-after-school": {
    scene: "petals",
    marks: "lower",
    celebrate: "petals",
    transition: "fade",
    numerals: "serif",
    ornament: "spark",
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
  },
  "fullmetal-alchemist-equivalent-exchange": {
    scene: "circles",
    marks: "greek",
    celebrate: "sparks",
    transition: "iris",
    numerals: "serif",
    ornament: "triangle",
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
  },
  "tea-obviously": {
    scene: "steam",
    type: "serif",
    marks: "lower",
    celebrate: "leaves",
    transition: "drop",
    numerals: "serif",
    ornament: "leaf",
  },
  "rum-and-coke": {
    marks: "alpha",
    celebrate: "bubbles",
    transition: "slide",
    numerals: "tabular",
    ornament: "dot",
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
  },

  // Cars
  "nissan-leaf": {
    marks: "numeric",
    celebrate: "leaves",
    transition: "slide",
    numerals: "segment",
    ornament: "bolt",
  },
  "toyota-prius-plus": {
    scene: "clouds",
    marks: "alpha",
    celebrate: "rings",
    transition: "fade",
    numerals: "tabular",
    ornament: "plus",
  },

  // School
  "wallington-grammar-school-arc": {
    marks: "alpha",
    celebrate: "stars",
    transition: "flip",
    numerals: "serif",
    ornament: "check",
  },
  "greenshaw-next-chapter": {
    scene: "chalk",
    marks: "numeric",
    celebrate: "confetti",
    transition: "wipe",
    numerals: "plain",
    ornament: "chevron",
  },
  "portsmouth-student-save-file": {
    scene: "pixels",
    type: "mono",
    marks: "fkeys",
    celebrate: "coins",
    transition: "shutter",
    numerals: "segment",
    ornament: "hash",
  },

  // Work
  "amazon-out-for-delivery": {
    scene: "parcels",
    marks: "numeric",
    celebrate: "confetti",
    transition: "slide",
    numerals: "stamped",
    ornament: "arrow",
  },
  "mchumza-birthday-meal": {
    type: "rounded",
    marks: "numeric",
    celebrate: "balloons",
    transition: "drop",
    numerals: "segment",
    ornament: "star",
  },
  "spoon-world-portsmouth-edition": {
    marks: "numeric",
    celebrate: "coins",
    transition: "fade",
    numerals: "stamped",
    ornament: "dot",
  },
  "fratton-park-matchday-shift": {
    marks: "numeric",
    celebrate: "confetti",
    transition: "wipe",
    numerals: "segment",
    ornament: "dot",
  },
  "stamford-bridge-on-the-clock": {
    heading: "glow",
    marks: "circled",
    celebrate: "stars",
    transition: "slide",
    numerals: "tabular",
    ornament: "chevron",
  },
  "goodwood-all-access": {
    scene: "chequered",
    marks: "numeric",
    celebrate: "sparks",
    transition: "skew",
    numerals: "outline",
    ornament: "flag",
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
  },
  "twickenham-under-the-floodlights": {
    marks: "circled",
    celebrate: "sparks",
    transition: "zoom",
    numerals: "stamped",
    ornament: "cross",
  },
  "corestream-risk-accepted": {
    scene: "chart",
    marks: "alpha",
    celebrate: "rings",
    transition: "wipe",
    numerals: "tabular",
    ornament: "arrow",
  },
  "501-fun-maximum-fun": {
    scene: "dartboard",
    marks: "numeric",
    celebrate: "rings",
    transition: "zoom",
    numerals: "segment",
    ornament: "target",
  },

  // Musicians
  "pitbull-mr-worldwide": {
    marks: "alpha",
    celebrate: "confetti",
    transition: "zoom",
    numerals: "outline",
    ornament: "arrow",
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
  },
  "yung-gravy-gravy-boat": {
    scene: "drips",
    marks: "lower",
    celebrate: "hearts",
    transition: "blur",
    numerals: "serif",
    ornament: "wave",
  },
  "rick-astley-never-gonna-log-you-out": {
    scene: "vinyl",
    marks: "alpha",
    celebrate: "notes",
    transition: "slide",
    numerals: "plain",
    ornament: "note",
  },
};

const resolved = new Map<ThemeId, ThemeIdentity>();

/** One stable object per theme, so components can compare identities cheaply. */
export function identityFor(id: ThemeId): ThemeIdentity {
  const cached = resolved.get(id);
  if (cached) return cached;
  const skin = skinFor(id);
  const flavour = flavours[id];
  const merged = { ...skin, ...deepSkinFor(skin), ...flavour };
  const identity = {
    ...merged,
    strength: flavour.strength ?? "normal",
  } as ThemeIdentity;
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

/** Text presentation, so a suit or die never turns into a colour emoji. */
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
  circled: [..."ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅ"],
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
