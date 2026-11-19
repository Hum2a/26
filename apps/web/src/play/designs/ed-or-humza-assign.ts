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
export const swipeFlickMinPx = 32;
export const swipeFlickVelocity = 0.45; // px/ms (450 px/s)
export const swipeFlickMaxMs = 280;
export const gestureAxisDeadzonePx = 8;

export type SwipeAxis = "horizontal" | "vertical" | null;

/** Lock a pointer drag once it leaves the deadzone so horizontal swipes never fight vertical scroll. */
export function lockSwipeAxis(dx: number, dy: number): SwipeAxis {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < gestureAxisDeadzonePx && absY < gestureAxisDeadzonePx) return null;
  if (absY > absX * 1.15) return "vertical";
  return "horizontal";
}

export function swipeThresholdPx(width: number): number {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 320;
  return Math.min(96, Math.max(56, safeWidth * 0.22));
}

export function swipeDecision(
  dx: number,
  dy: number,
  width: number,
  durationMs?: number,
  velocityPxPerMs?: number,
): "right" | "left" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX === 0 || absY > absX * 0.85) return null;

  // Fast flick: shorter travel still commits when velocity is clear and matches drag direction.
  const speed =
    velocityPxPerMs !== undefined && Number.isFinite(velocityPxPerMs)
      ? velocityPxPerMs
      : durationMs !== undefined &&
          Number.isFinite(durationMs) &&
          durationMs > 0 &&
          durationMs <= swipeFlickMaxMs
        ? dx / durationMs
        : 0;
  if (
    absX >= swipeFlickMinPx &&
    Math.sign(speed) === Math.sign(dx) &&
    Math.abs(speed) >= swipeFlickVelocity
  ) {
    return dx > 0 ? "right" : "left";
  }

  // Slow drag: commits once past the responsive distance threshold.
  const need = swipeThresholdPx(width);
  if (absX < need) return null;
  return dx > 0 ? "right" : "left";
}

/** Normalised drag progress in [-1, 1] for GPU-composited directional feedback. */
export function swipeProgress(dx: number, width: number): number {
  if (!Number.isFinite(dx)) return 0;
  const need = swipeThresholdPx(width);
  return Math.max(-1, Math.min(1, dx / need));
}

/** Pop the latest assignment step without ever emptying the base history state. */
export function undoPlacements(history: readonly TierPlacement[][]): TierPlacement[][] {
  return history.length > 1 ? history.slice(0, -1) : [...history];
}

export function isLongQuote(label: string, threshold = 110): boolean {
  return label.length > threshold;
}
