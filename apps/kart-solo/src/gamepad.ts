import { kartNeutral, type KartControls } from "@26/shared";
/** Browser access stays at the adapter boundary; mapping can use a supplied pad in tests. */
export function readGamepad(
  pad = navigator.getGamepads?.().find((p) => p?.connected),
): KartControls {
  if (!pad) return { ...kartNeutral };
  const axis = pad.axes[0] ?? 0;
  return {
    steer: Math.abs(axis) > 0.15 ? Math.max(-1, Math.min(1, axis)) : 0,
    gas: Boolean(pad.buttons[0]?.pressed),
    brake: Boolean(pad.buttons[1]?.pressed),
    drift: Boolean(pad.buttons[5]?.pressed || pad.buttons[7]?.pressed),
  };
}
