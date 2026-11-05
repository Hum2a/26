import { z } from "zod";

/**
 * Room-level kart choices the host can change from Live controls. Each one
 * only changes how phones and the stage draw or accept input; none changes
 * race rules, timing or points. Absent values resolve to the defaults below.
 */
export const kartSettingOptions = {
  /** Draw this phone's kart from its own controls before the room confirms. */
  prediction: ["off", "on", "on-conservative"],
  /** Carry other karts forward between room frames so they glide. */
  glide: ["off", "on"],
  /** Default steering control on a phone held sideways. */
  steering: ["pad-strip", "slider", "pad-absolute"],
  /** Highest phone frame rate; `auto` uses 60 unless the phone is on Low. */
  frameCap: ["30", "60", "auto"],
} as const;

export type KartSettingKey = keyof typeof kartSettingOptions;
export const kartSettingKeys = Object.keys(kartSettingOptions) as KartSettingKey[];

export const kartSettingsSchema = z
  .object({
    prediction: z.enum(kartSettingOptions.prediction).optional(),
    glide: z.enum(kartSettingOptions.glide).optional(),
    steering: z.enum(kartSettingOptions.steering).optional(),
    frameCap: z.enum(kartSettingOptions.frameCap).optional(),
  })
  .strict();
export type KartSettings = z.infer<typeof kartSettingsSchema>;
export type ResolvedKartSettings = Required<KartSettings>;

export const kartSettingDefaults: ResolvedKartSettings = {
  prediction: "on",
  glide: "on",
  steering: "pad-strip",
  frameCap: "auto",
};

/** One host change, validated so the value belongs to its key. */
export const kartSettingChangeSchema = z
  .object({
    key: z.enum(kartSettingKeys as [KartSettingKey, ...KartSettingKey[]]),
    value: z.string().min(1).max(32),
  })
  .strict()
  .refine(
    (change) =>
      (kartSettingOptions[change.key] as readonly string[]).includes(change.value),
    { message: "That value does not belong to this setting." },
  );
export type KartSettingChange = z.infer<typeof kartSettingChangeSchema>;

export const kartSettingHistorySchema = z
  .array(
    z
      .object({
        atMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        key: z.enum(kartSettingKeys as [KartSettingKey, ...KartSettingKey[]]),
        value: z.string().min(1).max(32),
      })
      .strict(),
  )
  .max(20);
export type KartSettingHistory = z.infer<typeof kartSettingHistorySchema>;

export function resolveKartSettings(
  settings: KartSettings | undefined,
): ResolvedKartSettings {
  return { ...kartSettingDefaults, ...(settings ?? {}) };
}

/** Apply a validated change and keep the last 20 entries of history. */
export function applyKartSetting(
  current: { settings?: KartSettings; history?: KartSettingHistory },
  change: KartSettingChange,
  atMs: number,
): { settings: KartSettings; history: KartSettingHistory } {
  return {
    settings: kartSettingsSchema.parse({
      ...(current.settings ?? {}),
      [change.key]: change.value,
    }),
    history: [
      ...(current.history ?? []),
      { atMs, key: change.key, value: change.value },
    ].slice(-20),
  };
}
