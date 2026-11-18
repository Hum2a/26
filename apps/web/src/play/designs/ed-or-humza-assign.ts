import type { TierPlacement } from "../controls/TierAssign";

export function assignQuote(
  current: readonly TierPlacement[],
  itemId: string,
  tierId: string,
): TierPlacement[] {
  return [...current.filter((entry) => entry.itemId !== itemId), { itemId, tierId }];
}

export function unassignQuote(
  current: readonly TierPlacement[],
  itemId: string,
): TierPlacement[] {
  return current.filter((entry) => entry.itemId !== itemId);
}

export function nextUnassigned<T extends { id: string }>(
  items: readonly T[],
  placements: readonly TierPlacement[],
): T | undefined {
  const taken = new Set(placements.map((entry) => entry.itemId));
  return items.find((item) => !taken.has(item.id));
}

export function countForTier(
  placements: readonly TierPlacement[],
  tierId: string,
): number {
  return placements.filter((entry) => entry.tierId === tierId).length;
}

/** Swipe left for the first (left-hand) bucket, right for the second. Ignore vertical pans. */
export const swipeCommitPx = 72;

export function swipeDecision(
  dx: number,
  dy: number,
  width: number,
): "right" | "left" | null {
  if (Math.abs(dy) > Math.abs(dx) * 0.85) return null;
  const need = Math.max(swipeCommitPx, width * 0.22);
  if (Math.abs(dx) < need) return null;
  return dx > 0 ? "right" : "left";
}
