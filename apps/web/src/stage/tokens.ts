import { themes } from "../theme/themes";
/**
 * Projector type and the text/background pairs the stage is allowed to use.
 * Sizes are pixels. Every pair is checked at 7:1.
 */

export const stageSizes = {
  body: 40,
  question: 72,
  timer: 120,
} as const;

export type StagePair = {
  name: string;
  text: string;
  background: string;
};

const palette = themes["26-basic"].colors;
export const stagePairs: readonly StagePair[] = [
  {
    name: "body on background",
    text: palette.foreground,
    background: palette.background,
  },
  { name: "body on surface", text: palette.foreground, background: palette.surface },
  { name: "muted on background", text: palette.muted, background: palette.background },
  { name: "muted on surface", text: palette.muted, background: palette.surface },
  {
    name: "question on background",
    text: palette.highlight,
    background: palette.background,
  },
  { name: "question on surface", text: palette.highlight, background: palette.surface },
  {
    name: "accent on background",
    text: palette.highlight,
    background: palette.background,
  },
  { name: "accent on surface", text: palette.highlight, background: palette.surface },
  {
    name: "ink on question",
    text: palette.highlightForeground,
    background: palette.highlight,
  },
];

const stageContrastMinimum = 7;

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const colour = hex.trim().toLowerCase();
  return (
    0.2126 * channel(colour, 1) +
    0.7152 * channel(colour, 3) +
    0.0722 * channel(colour, 5)
  );
}

export function contrastRatio(text: string, background: string): number {
  const lighter = Math.max(relativeLuminance(text), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(text), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function stagePairPasses(pair: StagePair): boolean {
  return contrastRatio(pair.text, pair.background) >= stageContrastMinimum;
}
