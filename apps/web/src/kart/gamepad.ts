import { kartNeutral, type KartControls } from "@26/shared";

export type KartControlPreferences = { sensitivity: number; deadzone: number };
export const defaultKartControls: KartControlPreferences = {
  sensitivity: 1,
  deadzone: 0.15,
};
const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;
export function kartControlPreferences(
  value: Partial<KartControlPreferences> = {},
): KartControlPreferences {
  return {
    sensitivity: Math.max(0.5, Math.min(1.5, finite(value.sensitivity ?? 1, 1))),
    deadzone: Math.max(0.05, Math.min(0.4, finite(value.deadzone ?? 0.15, 0.15))),
  };
}
/** A response curve changes the feel while retaining full steering at either end. */
export function controlSteering(value: number, sensitivity = 1): number {
  const bounded = Math.max(-1, Math.min(1, finite(value, 0)));
  if (bounded === 0) return 0;
  return (
    Math.sign(bounded) *
    Math.pow(Math.abs(bounded), 1 / kartControlPreferences({ sensitivity }).sensitivity)
  );
}
export type KartPad = Pick<Gamepad, "axes" | "buttons" | "connected" | "index">;
export type KartPadFrame = {
  available: boolean;
  index: number | null;
  controls: KartControls;
  item: boolean;
  recover: boolean;
};
const neutral = (): KartPadFrame => ({
  available: true,
  index: null,
  controls: { ...kartNeutral },
  item: false,
  recover: false,
});

/** Pure mapping, shared by connected phones, admin rehearsal and native solo. */
export function mapKartGamepad(
  pad: KartPad | null | undefined,
  preferences: Partial<KartControlPreferences> = {},
): KartPadFrame {
  if (!pad?.connected) return neutral();
  const prefs = kartControlPreferences(preferences);
  const axis = Math.max(-1, Math.min(1, finite(pad.axes[0] ?? 0, 0)));
  const magnitude = Math.max(
    0,
    (Math.abs(axis) - prefs.deadzone) / (1 - prefs.deadzone),
  );
  const pressed = (index: number) =>
    pad.buttons[index]?.pressed === true ||
    (Number.isFinite(pad.buttons[index]?.value) &&
      (pad.buttons[index]?.value ?? 0) >= 0.5);
  return {
    available: true,
    index: pad.index,
    controls: {
      steer: controlSteering(Math.sign(axis) * magnitude, prefs.sensitivity),
      gas: pressed(0),
      brake: pressed(1),
      drift: pressed(5) || pressed(7),
    },
    item: pressed(2),
    recover: pressed(3),
  };
}

/** This is the only browser access. Refused/unsupported APIs leave touch usable. */
export function readKartGamepad(
  preferences: Partial<KartControlPreferences> = {},
  scan = () => navigator.getGamepads(),
): KartPadFrame {
  try {
    const pads = scan();
    return mapKartGamepad(
      Array.from(pads).find((pad) => pad?.connected),
      preferences,
    );
  } catch {
    return { ...neutral(), available: false };
  }
}

/** Compatibility export for callers that only need driving controls. */
export function readGamepad(pad?: KartPad | null): KartControls {
  return pad === undefined ? readKartGamepad().controls : mapKartGamepad(pad).controls;
}
