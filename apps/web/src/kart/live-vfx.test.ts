import { expect, it } from "vitest";
import { defaultKartVfxPreset, kartVfxPresetSchema } from "@26/shared";
import { liveKartVfxPreset } from "./live-vfx";
it("keeps old races legacy, explicitly enables or disables the validated presentation", () => {
  expect(liveKartVfxPreset(undefined)).toBeUndefined();
  expect(liveKartVfxPreset(true)).toBe(defaultKartVfxPreset);
  expect(liveKartVfxPreset(false)?.enabled).toBe(false);
  expect(kartVfxPresetSchema.safeParse(liveKartVfxPreset(false)).success).toBe(true);
  expect(liveKartVfxPreset(false)).toBe(liveKartVfxPreset(false));
});
