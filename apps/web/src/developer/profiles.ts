import {
  defaultRehearsalConfig,
  rehearsalConfigSchema,
  type RehearsalConfig,
} from "@26/shared";

const key = "26-rehearsal-profiles-v1";
export type RehearsalProfile = { name: string; config: RehearsalConfig };
export const builtInProfiles: RehearsalProfile[] = [10, 25, 50, 75, 100].map(
  (botCount) => ({
    name: `${botCount} bots`,
    config: { ...defaultRehearsalConfig, botCount },
  }),
);
export function readProfiles(): RehearsalProfile[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).flatMap((value) => {
      if (
        !value ||
        typeof value !== "object" ||
        typeof value.name !== "string" ||
        !value.name.trim() ||
        value.name.length > 40
      )
        return [];
      const result = rehearsalConfigSchema.safeParse(value.config);
      return result.success ? [{ name: value.name, config: result.data }] : [];
    });
  } catch {
    return [];
  }
}
export function saveProfile(name: string, config: RehearsalConfig) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error("Give the setup a name.");
  const next = [
    { name: trimmed, config: rehearsalConfigSchema.parse(config) },
    ...readProfiles().filter((p) => p.name !== trimmed),
  ].slice(0, 10);
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}
export function deleteProfile(name: string) {
  const next = readProfiles().filter((p) => p.name !== name);
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}
