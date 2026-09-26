export type AppliedTroll = {
  effectId: string;
  role: "actor" | "target";
  status: "queued" | "active";
  /** Present only when the guest payload already names the sender. It does not. */
  troller?: string;
};

/**
 * A troll that has just become active on this phone.
 * The first snapshot is a baseline, so a reconnect does not toast again.
 */
export function newSelfTroll(
  previous: readonly AppliedTroll[] | null,
  next: readonly AppliedTroll[],
): { effectId: string; troller?: string } | null {
  if (!previous) {
    return null;
  }
  const seen = new Set(
    previous
      .filter((effect) => effect.status === "active")
      .map((effect) => effect.effectId),
  );
  for (const effect of next) {
    if (
      effect.role !== "target" ||
      effect.status !== "active" ||
      seen.has(effect.effectId)
    ) {
      continue;
    }
    const troller = effect.troller?.trim();
    return troller
      ? { effectId: effect.effectId, troller }
      : { effectId: effect.effectId };
  }
  return null;
}
