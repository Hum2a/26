import { describe, expect, it, vi } from "vitest";
import { hapticCues, promptBuzz, triggerHaptic, trollBuzz } from "./haptic-triggers";

describe("haptic triggers", () => {
  it("buzzes when the phase changes to PROMPT", () => {
    triggerHaptic({ type: "PHASE_CHANGE", phase: "PROMPT" });
    expect(navigator.vibrate).toHaveBeenCalledWith(promptBuzz);
    vi.mocked(navigator.vibrate).mockClear();
    triggerHaptic({ type: "PHASE_CHANGE", phase: "prompt" });
    expect(navigator.vibrate).toHaveBeenCalledWith(promptBuzz);
  });

  it("buzzes when a troll is applied to this phone", () => {
    triggerHaptic({ type: "TROLL_APPLIED", target: "self" });
    expect(navigator.vibrate).toHaveBeenCalledWith(trollBuzz);
  });

  it("stays quiet for other phases and trolls aimed elsewhere", () => {
    triggerHaptic({ type: "PHASE_CHANGE", phase: "collect" });
    triggerHaptic({ type: "PHASE_CHANGE", phase: "lobby" });
    triggerHaptic({ type: "TROLL_APPLIED", target: "other" });
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("uses the first snapshot as a baseline", () => {
    const active = {
      effectId: "effect-1",
      role: "target" as const,
      status: "active" as const,
    };
    expect(
      hapticCues(null, {
        phase: "prompt",
        effects: [active],
      }),
    ).toEqual([]);
    expect(
      hapticCues(
        { phase: "intro", effects: [] },
        { phase: "prompt", effects: [active] },
      ).map((cue) => cue.type),
    ).toEqual(["PHASE_CHANGE", "TROLL_APPLIED"]);
  });
});
