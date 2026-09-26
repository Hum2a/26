import { buzz } from "../device/haptics";

/** Entering the prompt phase. Wire snapshots use the lowercase phase name. */
export const promptBuzz: VibratePattern = [20];

/** A troll that landed on this phone. */
export const trollBuzz: VibratePattern = [28, 36, 28];

export type HapticEffect = {
  effectId: string;
  role: "actor" | "target";
  status: "queued" | "active";
};

export type HapticView = {
  phase: string;
  effects: HapticEffect[];
};

export type HapticCue =
  | { type: "PHASE_CHANGE"; phase: string }
  | { type: "TROLL_APPLIED"; target: "self" | "other" };

export function isPromptPhase(phase: string): boolean {
  return phase.toLowerCase() === "prompt";
}

/** Buzz for a prompt phase change, or a troll applied to this phone. */
export function triggerHaptic(cue: HapticCue): void {
  if (cue.type === "PHASE_CHANGE" && isPromptPhase(cue.phase)) {
    buzz(promptBuzz);
    return;
  }
  if (cue.type === "TROLL_APPLIED" && cue.target === "self") {
    buzz(trollBuzz);
  }
}

/**
 * Diff two guest views. The first snapshot is a baseline, so a reconnect
 * does not replay trolls that were already active.
 */
export function hapticCues(previous: HapticView | null, next: HapticView): HapticCue[] {
  if (!previous) {
    return [];
  }
  const cues: HapticCue[] = [];
  if (previous.phase !== next.phase) {
    cues.push({ type: "PHASE_CHANGE", phase: next.phase });
  }
  const seen = new Set(
    previous.effects
      .filter((effect) => effect.status === "active")
      .map((effect) => effect.effectId),
  );
  for (const effect of next.effects) {
    if (effect.status !== "active" || seen.has(effect.effectId)) {
      continue;
    }
    cues.push({
      type: "TROLL_APPLIED",
      target: effect.role === "target" ? "self" : "other",
    });
  }
  return cues;
}
