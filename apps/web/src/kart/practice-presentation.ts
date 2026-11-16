import {
  driverStyleSchema,
  kartVfxPresetSchema,
  kartLookPresetSchema,
  type KartLookPreset,
  type KartVfxPreset,
  type DriverStyle,
} from "@26/shared";

export const practicePresentationKind = "kart-practice-presentation";
export const practiceFaceLimit = 2 * 1024 * 1024;
/** Explicit local presentation only. Never accepts URLs, media IDs or credentials. */
export function readPracticePresentation(value: unknown):
  | {
      style: DriverStyle;
      face?: Blob | null;
      effects?: KartVfxPreset | null;
      look?: KartLookPreset | null;
    }
  | undefined {
  if (!value || typeof value !== "object") return;
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !["kind", "style", "face", "effects", "look"].includes(key),
    )
  )
    return;
  const style = driverStyleSchema.safeParse(data.style);
  if (data.kind !== practicePresentationKind || !style.success) return;
  if (
    "face" in data &&
    data.face !== null &&
    (!(data.face instanceof Blob) ||
      data.face.size > practiceFaceLimit ||
      !["image/jpeg", "image/png", "image/webp"].includes(data.face.type))
  )
    return;
  const face = "face" in data ? { face: data.face as Blob | null } : {};
  let look: KartLookPreset | null | undefined;
  if ("look" in data) {
    if (data.look === null) look = null;
    else {
      const parsed = kartLookPresetSchema.safeParse(data.look);
      if (!parsed.success) return;
      look = parsed.data;
    }
  }
  const localLook = look !== undefined ? { look } : {};
  if ("effects" in data) {
    if (data.effects === null)
      return { style: style.data, ...face, ...localLook, effects: null };
    const effects = kartVfxPresetSchema.safeParse(data.effects);
    if (!effects.success) return;
    return { style: style.data, ...face, ...localLook, effects: effects.data };
  }
  return { style: style.data, ...face, ...localLook };
}
