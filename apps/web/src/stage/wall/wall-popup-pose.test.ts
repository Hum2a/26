import { expect, it } from "vitest";
import { wallPopupPose } from "./wall-popup-pose";

it("keeps each photo on a stable jaunty pose inside the projector", () => {
  const first = wallPopupPose("00000000-0000-4000-8000-000000000001");
  const again = wallPopupPose("00000000-0000-4000-8000-000000000001");
  const other = wallPopupPose("00000000-0000-4000-8000-000000000002");
  expect(first).toEqual(again);
  expect(first).not.toEqual(other);
  expect(first.rotate).toBeGreaterThanOrEqual(-7);
  expect(first.rotate).toBeLessThanOrEqual(7);
  expect(first.x).toBeGreaterThanOrEqual(6);
  expect(first.x).toBeLessThanOrEqual(21);
  expect(first.y).toBeGreaterThanOrEqual(10);
  expect(first.y).toBeLessThanOrEqual(29);
  expect(["left", "right"]).toContain(first.side);
});
