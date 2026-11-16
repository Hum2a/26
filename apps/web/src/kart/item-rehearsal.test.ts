import { expect, it } from "vitest";
import { movingItemRehearsal, noTargetHomingRehearsal } from "./item-rehearsal";
import { restoreKartProjectiles } from "@26/shared";
it("rehearses the actual no-target homing boost with a visibly finished stand-in", () => {
  const sample = noTargetHomingRehearsal();
  expect(sample.actors[1]!.status).toBe("FINISHED");
  expect(sample.actors[0]!.power).toMatchObject({ item: null, turboUntil: 600 });
  expect(sample.world.projectiles).toEqual([]);
});
for (const kind of ["tennis", "bomb", "homing"] as const)
  it(`rehearses moving ${kind} with actual driving and persisted-clock item rules`, () => {
    const sample = movingItemRehearsal(kind);
    expect(sample).toEqual(movingItemRehearsal(kind));
    expect(sample.world.elapsedMs).toBe(3000);
    expect(sample.actors[0]!.z).not.toBe(-8);
    expect(sample.actors[1]!.z).not.toBe(8);
    expect(sample.world.history).toContainEqual(
      expect.objectContaining({ kind: "launch", item: kind, atMs: 500 }),
    );
    expect(sample.actors[0]!.power.item).toBeNull();
    expect(restoreKartProjectiles(JSON.parse(JSON.stringify(sample.world)))).toEqual(
      sample.world,
    );
  });
