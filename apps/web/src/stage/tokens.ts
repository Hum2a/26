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

export const stagePairs: readonly StagePair[] = [
  { name: "body on background", text: "#fff6e8", background: "#14110e" },
  { name: "body on surface", text: "#fff6e8", background: "#2c241c" },
  { name: "muted on background", text: "#e4d5c0", background: "#14110e" },
  { name: "muted on surface", text: "#e4d5c0", background: "#2c241c" },
  { name: "question on background", text: "#ffc43a", background: "#14110e" },
  { name: "question on surface", text: "#ffc43a", background: "#2c241c" },
  { name: "accent on background", text: "#ffa08a", background: "#14110e" },
  { name: "accent on surface", text: "#ffa08a", background: "#2c241c" },
  { name: "ink on accent", text: "#1a100e", background: "#ffa08a" },
  { name: "ink on question", text: "#1a100e", background: "#ffc43a" },
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
