import { expect, it } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
import { importedSurfaceAt } from "../../../../packages/shared/src/kart/kart-track";
import { vfxRehearsalRace, vfxScripts } from "./vfx-rehearsal";
const sample = () =>
  projectKartRace(
    createKartRace("sample", [{ playerId: "stand-in", name: "Stand-in" }], {
      trackId: "mario-circuit-v1",
    }),
    "stand-in",
    0,
  );
it("renders bounded moving public samples for all effects without mutating the source or awarding points", () => {
  const source = sample(),
    before = JSON.stringify(source);
  for (const script of vfxScripts) {
    const a = vfxRehearsalRace(source, script, 0, 1),
      b = vfxRehearsalRace(source, script, 1000, 1);
    expect(b.participants[0]!.z).toBeLessThan(a.participants[0]!.z);
    expect(b.leaderboard.every((row) => row.points === 0)).toBe(true);
    expect(vfxRehearsalRace(source, script, Infinity, 1).elapsedMs).toBe(0);
    expect(vfxRehearsalRace(source, script, 100000, 1).ended).toBe(true);
  }
  expect(JSON.stringify(source)).toBe(before);
});
it("places dust on actual dirt, lifts flight poses and generates a finite contact edge", () => {
  const source = sample();
  const dirt = vfxRehearsalRace(source, "dirt", 2000, 1).participants[0]!;
  expect(importedSurfaceAt(dirt.x, dirt.z)).toBe("dirt");
  expect(vfxRehearsalRace(source, "flight", 2000, 1).participants[0]!.height).toBe(3);
  expect(vfxRehearsalRace(source, "impact", 1400, 1).participants[0]!.contact).toBe(
    false,
  );
  expect(vfxRehearsalRace(source, "impact", 1600, 1).participants[0]!.contact).toBe(
    true,
  );
  expect(vfxRehearsalRace(source, "impact", 1800, 1).participants[0]!.contact).toBe(
    false,
  );
});
it("has a stable finite finish envelope and an explicit new run for replay", () => {
  const source = sample();
  expect(vfxRehearsalRace(source, "finish", 0, 1).presentation).toBeUndefined();
  const finish = vfxRehearsalRace(source, "finish", 3000, 1);
  expect(finish.presentation?.events[0]?.atMs).toBe(3000);
  expect(vfxRehearsalRace(source, "finish", 8000, 1).presentation).toEqual(
    finish.presentation,
  );
  expect(vfxRehearsalRace(source, "finish", 0, 2).raceId).not.toBe(finish.raceId);
});
