/**
 * Stable, per-photo overlay pose so each projector pop-up sits at a slightly
 * different gallery tilt without covering the whole stage.
 */
export type WallPopupPose = {
  rotate: number;
  side: "left" | "right";
  x: number;
  y: number;
  stackRotate: number;
};

export function wallPopupPose(postId: string): WallPopupPose {
  let hash = 2166136261;
  for (let index = 0; index < postId.length; index += 1) {
    hash ^= postId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const n = hash >>> 0;
  return {
    rotate: (n % 15) - 7,
    side: n % 2 === 0 ? "left" : "right",
    x: 6 + (n % 16),
    y: 10 + ((n >>> 5) % 20),
    stackRotate: ((n >>> 8) % 11) - 5,
  };
}
