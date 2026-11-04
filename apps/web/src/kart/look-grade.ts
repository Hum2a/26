import { kartHueBands, isNeutralKartGrade, type KartLookPreset } from "@26/shared";
export type LookColour = [number, number, number];
export const hueCentres = [0, 30, 60, 120, 180, 240, 270, 300] as const;
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function hsl(rgb: LookColour): LookColour {
  const [r, g, b] = rgb,
    hi = Math.max(...rgb),
    lo = Math.min(...rgb),
    d = hi - lo,
    l = (hi + lo) / 2;
  if (d < 1e-8) return [0, 0, l];
  const h =
    hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, d / Math.max(1e-8, 1 - Math.abs(2 * l - 1)), l];
}
function rgb([h, s, l]: LookColour): LookColour {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    v = (((h % 1) + 1) % 1) * 6,
    x = c * (1 - Math.abs((v % 2) - 1));
  const out =
    v < 1
      ? [c, x, 0]
      : v < 2
        ? [x, c, 0]
        : v < 3
          ? [0, c, x]
          : v < 4
            ? [0, x, c]
            : v < 5
              ? [x, 0, c]
              : [c, 0, x];
  return out.map((n) => n + l - c / 2) as LookColour;
}
/** CPU reference for the linear-light grading kernel, before the renderer's output transform. */
export function gradeKartColour(
  input: LookColour,
  preset: KartLookPreset,
  shadow: LookColour,
  highlight: LookColour,
): LookColour {
  if (isNeutralKartGrade(preset)) return [...input];
  const g = preset.grading;
  let c = [0, 1, 2].map(
    (row) =>
      g.mixer[row * 3]! * input[0] +
      g.mixer[row * 3 + 1]! * input[1] +
      g.mixer[row * 3 + 2]! * input[2],
  ) as LookColour;
  const gains = [1 + g.temperature * 0.15, 1 + g.tint * 0.1, 1 - g.temperature * 0.15];
  c = c.map((v, i) =>
    Math.max(
      0,
      (v * gains[i]! * 2 ** g.exposure - 0.18) * g.contrast + 0.18 + g.brightness,
    ),
  ) as LookColour;
  const peak = Math.max(1, ...c),
    base = hsl(c.map((v) => v / peak) as LookColour),
    degrees = base[0] * 360;
  let shift: LookColour = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const lo = hueCentres[i]!,
      hi = i === 7 ? 360 : hueCentres[i + 1]!;
    if (degrees < lo || degrees >= hi) continue;
    const a = g.hsl[kartHueBands[i]!],
      b = g.hsl[kartHueBands[(i + 1) % 8]!],
      t = (degrees - lo) / (hi - lo);
    shift = [
      mix(a.hue, b.hue, t),
      mix(a.saturation, b.saturation, t),
      mix(a.lightness, b.lightness, t),
    ];
  }
  c = rgb([
    base[0] + (g.hue + shift[0]) / 360,
    clamp(base[1] * g.saturation * (1 + g.vibrance * (1 - base[1])) * (1 + shift[1])),
    clamp(base[2] + shift[2]),
  ]).map((v) => v * peak) as LookColour;
  if (g.splitAmount > 0) {
    const l = clamp(c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722),
      t = clamp((l - g.splitBalance + 0.2) / 0.4),
      smooth = t * t * (3 - 2 * t);
    c = c.map((v, i) =>
      mix(v, mix(shadow[i]!, highlight[i]!, smooth) * Math.max(0.05, l), g.splitAmount),
    ) as LookColour;
  }
  return c.map((v) => Math.max(0, v) ** (1 / g.gamma)) as LookColour;
}
