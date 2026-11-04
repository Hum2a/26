import { defaultKartVfxPreset } from "@26/shared";
const disabled = { ...defaultKartVfxPreset, enabled: false };
/** Absent flags keep older races on their legacy presentation. Explicit off clears decoration. */
export const liveKartVfxPreset = (enabled: boolean | undefined) =>
  enabled === undefined ? undefined : enabled ? defaultKartVfxPreset : disabled;
