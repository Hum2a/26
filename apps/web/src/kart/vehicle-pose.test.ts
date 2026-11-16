import { expect, it } from "vitest";
import { vehiclePose } from "./vehicle-pose";

it("uses accepted travel for wheel rotation without integrating speed or a local clock", () => {
  const first = vehiclePose({ speed: 1, turnRate: 0, travel: 2 }, false);
  expect(vehiclePose({ speed: 100, turnRate: 0, travel: 2 }, false).wheelRotation).toBe(
    first.wheelRotation,
  );
  expect(vehiclePose({ speed: -1, turnRate: 0, travel: -2 }, false).wheelRotation).toBe(
    -first.wheelRotation,
  );
});
it("bounds steering and chassis roll and removes decorative motion in reduced motion", () => {
  const pose = vehiclePose({ speed: 100, turnRate: 100, travel: 200 }, false);
  expect(Math.abs(pose.steering)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(pose.roll)).toBeLessThanOrEqual(0.12);
  const reduced = vehiclePose({ speed: 100, turnRate: 100, travel: 200 }, true);
  expect(reduced.roll).toBe(0);
  expect(reduced.wheelRotation).toBe(0);
  expect(reduced.steering).toBe(pose.steering);
});
it("does not produce non-finite angles from an unavailable motion sample", () => {
  const pose = vehiclePose(
    { speed: NaN, turnRate: Infinity, travel: -Infinity },
    false,
  );
  expect([pose.steering, pose.roll, pose.wheelRotation].every(Number.isFinite)).toBe(
    true,
  );
  expect(
    Number.isFinite(
      vehiclePose({ speed: 0, turnRate: 0, travel: Number.MAX_VALUE }, false)
        .wheelRotation,
    ),
  ).toBe(true);
});
