import { expect, it } from "vitest";
import {
  applyKartSetting,
  kartSettingChangeSchema,
  kartSettingDefaults,
  kartSettingsSchema,
  resolveKartSettings,
} from "@26/shared";

it("resolves absent settings to the defaults and keeps chosen ones", () => {
  expect(resolveKartSettings(undefined)).toEqual(kartSettingDefaults);
  expect(resolveKartSettings({ glide: "off" })).toEqual({
    ...kartSettingDefaults,
    glide: "off",
  });
});

it("accepts only values that belong to their key", () => {
  expect(
    kartSettingChangeSchema.safeParse({ key: "frameCap", value: "60" }).success,
  ).toBe(true);
  for (const bad of [
    { key: "frameCap", value: "off" },
    { key: "prediction", value: "60" },
    { key: "unknown", value: "on" },
    { key: "glide", value: "on", extra: true },
  ])
    expect(kartSettingChangeSchema.safeParse(bad).success).toBe(false);
  expect(kartSettingsSchema.safeParse({ glide: "sideways" }).success).toBe(false);
});

it("applies a change and keeps only the last 20 history entries", () => {
  let state = {};
  for (let i = 0; i < 25; i++)
    state = applyKartSetting(
      state,
      { key: "steering", value: i % 2 ? "slider" : "pad-strip" },
      i,
    );
  const last = state as ReturnType<typeof applyKartSetting>;
  expect(last.history).toHaveLength(20);
  expect(last.history[0]!.atMs).toBe(5);
  expect(last.settings).toEqual({ steering: "pad-strip" });
});
