import type { ThemeId } from "./themes";

/**
 * Identity on top of a palette. Colours stay in themes.ts.
 * 26 basic is the only theme without a skin. Every other theme joins a family.
 */

export const skinGrounds = [
  "flat",
  "slash",
  "split",
  "stripes",
  "grid",
  "tiles",
  "sunset",
  "charge",
  "glow",
  "horizon",
  "ruled",
  "floodlight",
  "foil",
  "tape",
] as const;

export const skinShapes = [
  "round",
  "sharp",
  "chunky",
  "soft",
  "ticket",
  "cut",
] as const;

export const skinMarks = [
  "numeral",
  "mask",
  "card",
  "cup",
  "shades",
  "spoon",
  "skyline",
  "terminal",
  "note",
  "sun",
  "beam",
  "ring",
  "stamp",
  "star",
  "mic",
  "leaf",
  "plus",
] as const;

export const skinFinishes = [
  "solid",
  "glass",
  "cartoon",
  "realistic",
  "minimal",
  "extravagant",
] as const;

export const skinMotifs = ["none", "crest", "scatter", "bleed"] as const;

export const motifIcons = [
  "nissan",
  "toyota",
  "sun",
  "card",
  "mic",
  "star",
  "utensils",
  "mask",
] as const;

export type SkinGround = (typeof skinGrounds)[number];
export type SkinShape = (typeof skinShapes)[number];
export type SkinMark = (typeof skinMarks)[number];
export type SkinFinish = (typeof skinFinishes)[number];
export type SkinMotif = (typeof skinMotifs)[number];
export type MotifIcon = (typeof motifIcons)[number];

type SkinBase = {
  id: string;
  ground: SkinGround;
  shape: SkinShape;
  mark: SkinMark;
  finish: SkinFinish;
};

export type ThemeSkin = SkinBase &
  ({ motif: "none" } | { motif: Exclude<SkinMotif, "none">; icon: MotifIcon });

type SkinInput = SkinBase &
  ({ motif?: "none" } | { motif: Exclude<SkinMotif, "none">; icon: MotifIcon });

export const plainSkin: ThemeSkin = {
  id: "plain",
  ground: "flat",
  shape: "round",
  mark: "numeral",
  finish: "solid",
  motif: "none",
};

type SkinnedThemeId = Exclude<ThemeId, "26-basic">;

function family<const T extends readonly SkinnedThemeId[]>(
  ids: T,
  skin: SkinInput,
): { [K in T[number]]: ThemeSkin } {
  const full = { motif: "none" as const, ...skin } as ThemeSkin;
  return Object.fromEntries(ids.map((id) => [id, full])) as {
    [K in T[number]]: ThemeSkin;
  };
}

const skinned = {
  ...family(["persona-5-take-your-time"], {
    id: "persona-5",
    ground: "slash",
    shape: "sharp",
    mark: "mask",
    finish: "cartoon",
    motif: "bleed",
    icon: "mask",
  }),
  ...family(["ps2-memory-card"], {
    id: "ps2",
    ground: "grid",
    shape: "chunky",
    mark: "card",
    finish: "realistic",
    motif: "crest",
    icon: "card",
  }),
  ...family(["cafe-leblanc-but-make-it-tea"], {
    id: "leblanc-tea",
    ground: "split",
    shape: "soft",
    mark: "cup",
    finish: "realistic",
  }),
  ...family(["pitbull-mr-worldwide"], {
    id: "pitbull",
    ground: "stripes",
    shape: "round",
    mark: "shades",
    finish: "extravagant",
  }),
  ...family(["spoon-world-portsmouth-edition"], {
    id: "spoon-world",
    ground: "tiles",
    shape: "ticket",
    mark: "spoon",
    finish: "cartoon",
    motif: "scatter",
    icon: "utensils",
  }),
  ...family(["gta-vi-vice-birthday"], {
    id: "vice",
    ground: "sunset",
    shape: "cut",
    mark: "skyline",
    finish: "extravagant",
  }),
  ...family(
    [
      "phantom-thieves-of-portsmouth",
      "naruto-akatsuki",
      "persona-1-origins",
      "persona-2-innocent-birthday",
      "persona-3-portable-pink-route",
      "my-hero-academia-plus-ultra",
    ],
    {
      id: "slash",
      ground: "slash",
      shape: "sharp",
      mark: "mask",
      finish: "cartoon",
      motif: "bleed",
      icon: "mask",
    },
  ),
  ...family(["fullmetal-alchemist-equivalent-exchange"], {
    id: "slash",
    ground: "slash",
    shape: "sharp",
    mark: "ring",
    finish: "cartoon",
    motif: "bleed",
    icon: "mask",
  }),
  ...family(["smash-final-destination"], {
    id: "slash",
    ground: "slash",
    shape: "sharp",
    mark: "star",
    finish: "cartoon",
    motif: "bleed",
    icon: "mask",
  }),
  ...family(
    [
      "humza-os",
      "birthday-exe",
      "localhost-26",
      "commit-twenty-six",
      "just-one-more-game",
      "scarlet-nexus-brain-drive",
      "26-humza-website",
      "one-more-tweak",
      "overengineered-birthday",
      "humzas-control-room",
      "usual-table-laptop-open",
    ],
    { id: "crt", ground: "grid", shape: "chunky", mark: "terminal", finish: "minimal" },
  ),
  ...family(
    [
      "cafe-leblanc",
      "tea-obviously",
      "paper-party",
      "chinese-takeaway-at-humzas",
      "one-more-plate",
      "midnight-matcha",
      "pistachio-party",
      "peach-please",
      "sorbet-social",
      "lavender-menace",
      "soft-launch-hard-questions",
    ],
    { id: "paper", ground: "split", shape: "soft", mark: "cup", finish: "realistic" },
  ),
  ...family(
    [
      "dj-khaled-another-one",
      "bbno-birthday-budget",
      "yung-gravy-gravy-boat",
      "velvet-rope",
      "ultraviolet",
      "electric-orchid",
      "deep-sea-disco",
      "cobalt-club",
      "rum-and-coke",
      "black-cherry",
      "petrol-and-peach",
      "ember-room",
      "mixtape-26",
    ],
    {
      id: "club",
      ground: "stripes",
      shape: "round",
      mark: "shades",
      finish: "extravagant",
    },
  ),
  ...family(["rick-astley-never-gonna-log-you-out"], {
    id: "club",
    ground: "stripes",
    shape: "round",
    mark: "note",
    finish: "extravagant",
  }),
  ...family(
    [
      "mchumza-birthday-meal",
      "restaurant-shift-last-orders",
      "amazon-out-for-delivery",
      "501-fun-maximum-fun",
    ],
    { id: "service", ground: "tiles", shape: "ticket", mark: "spoon", finish: "solid" },
  ),
  ...family(["corestream-risk-accepted", "made-by-humza"], {
    id: "service",
    ground: "tiles",
    shape: "ticket",
    mark: "stamp",
    finish: "solid",
  }),
  ...family(["gta-vi-made-me-late", "retro-future"], {
    id: "sunset",
    ground: "sunset",
    shape: "cut",
    mark: "skyline",
    finish: "extravagant",
  }),
  ...family(
    [
      "version-26",
      "main-character",
      "the-humza-show",
      "humza-according-to-everyone",
      "21-november",
    ],
    {
      id: "show",
      ground: "stripes",
      shape: "round",
      mark: "star",
      finish: "extravagant",
    },
  ),
  ...family(["baseer-live", "baseer-has-the-mic"], {
    id: "mic",
    ground: "glow",
    shape: "round",
    mark: "mic",
    finish: "extravagant",
    motif: "crest",
    icon: "mic",
  }),
  ...family(
    [
      "the-velvet-room",
      "persona-3-midnight-hour",
      "moonlit-chrome",
      "november-nights",
      "humza-after-hours",
      "pokemon-gengar-hours",
      "final-fantasy-vii-mako",
    ],
    { id: "glow", ground: "glow", shape: "soft", mark: "mask", finish: "glass" },
  ),
  ...family(
    [
      "persona-4-golden-hour",
      "your-name-twilight-thread",
      "tsukigakirei-moonlit-walk",
      "naruto-hidden-leaf",
      "pokemon-pallet-town",
      "chocobo-crossing",
      "blue-hour",
      "poolside-2000",
      "final-fantasy-crystal-prelude",
      "dragon-ball-capsule-corp",
      "bunny-girl-senpai-after-school",
    ],
    {
      id: "horizon",
      ground: "horizon",
      shape: "soft",
      mark: "sun",
      finish: "glass",
      motif: "crest",
      icon: "sun",
    },
  ),
  ...family(
    [
      "wallington-grammar-school-arc",
      "greenshaw-next-chapter",
      "portsmouth-student-save-file",
      "the-humza-archives",
    ],
    { id: "ruled", ground: "ruled", shape: "chunky", mark: "numeral", finish: "solid" },
  ),
  ...family(
    [
      "fratton-park-matchday-shift",
      "stamford-bridge-on-the-clock",
      "twickenham-under-the-floodlights",
      "queens-centre-court",
      "goodwood-all-access",
    ],
    {
      id: "floodlight",
      ground: "floodlight",
      shape: "cut",
      mark: "beam",
      finish: "realistic",
    },
  ),
  ...family(
    [
      "26-karat",
      "playstation-platinum-trophy",
      "confetti-department",
      "high-score-club",
      "bragging-rights",
      "steal-the-spotlight",
      "quarter-life-deluxe",
      "dragon-ball-birthday-saiyan",
      "super-saiyan-closing-shift",
      "humza-studio",
    ],
    {
      id: "foil",
      ground: "foil",
      shape: "round",
      mark: "star",
      finish: "extravagant",
      motif: "scatter",
      icon: "star",
    },
  ),
  ...family(
    [
      "absolutely-rigged",
      "big-red-button",
      "keijo-absolutely-necessary",
      "risk-assessment-keijo",
      "friendly-sabotage",
      "plot-twist",
      "the-hot-seat",
      "final-answer",
    ],
    { id: "tape", ground: "tape", shape: "sharp", mark: "numeral", finish: "cartoon" },
  ),
  ...family(["nissan-leaf"], {
    id: "leaf",
    ground: "charge",
    shape: "soft",
    mark: "leaf",
    finish: "solid",
    motif: "crest",
    icon: "nissan",
  }),
  ...family(["toyota-prius-plus"], {
    id: "prius",
    ground: "horizon",
    shape: "soft",
    mark: "plus",
    finish: "solid",
    motif: "crest",
    icon: "toyota",
  }),
} satisfies Record<SkinnedThemeId, ThemeSkin>;

export function skinFor(id: ThemeId): ThemeSkin {
  if (id === "26-basic") {
    return plainSkin;
  }
  return skinned[id];
}

export const skinnedThemeIds = Object.keys(skinned) as SkinnedThemeId[];
