import { expect, it } from "vitest";
import { selectKartTarget, type KartTarget } from "@26/shared";
const owner: KartTarget = { playerId: "a", number: 1, progress: 0.2, status: "RACING" };
it("selects the nearest active racer ahead with a deterministic number tie-break", () => {
  const actors: KartTarget[] = [
    owner,
    { playerId: "far", number: 2, progress: 0.8, status: "RACING" },
    { playerId: "near", number: 4, progress: 0.3, status: "RACING" },
    { playerId: "tie", number: 3, progress: 0.3, status: "RACING" },
  ];
  expect(selectKartTarget(owner, actors)).toBe("tie");
  expect(selectKartTarget(owner, [...actors].reverse())).toBe("tie");
});
it("never selects the owner, a trailing/tied racer, a finisher or a departed racer", () => {
  expect(
    selectKartTarget(owner, [
      owner,
      { playerId: "behind", number: 2, progress: 0.1, status: "RACING" },
      { playerId: "tied", number: 3, progress: 0.2, status: "RACING" },
      { playerId: "finished", number: 4, progress: 0.9, status: "FINISHED" },
      { playerId: "dnf", number: 5, progress: 0.4, status: "DNF" },
    ]),
  ).toBeUndefined();
});
