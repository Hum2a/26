import { expect, it } from "vitest";
import type { KartHit, KartRaceView } from "@26/shared";
import { hitTickerLines, itemWord, selfHitCues } from "./hit-feed";

function race(hits: KartHit[], self = "b"): KartRaceView {
  return {
    raceId: "race",
    selfPlayerId: self,
    participants: [
      { playerId: "a", name: "Amina" },
      { playerId: "b", name: "Chen" },
      { playerId: "c", name: "Dev" },
    ],
    presentation: {
      version: 3,
      items: { hits },
    },
  } as unknown as KartRaceView;
}

it("tells this phone who hit it, who it hit and when a shield saved it, once each", () => {
  const seen = new Set<number>();
  const view = race([
    { eventId: 1, atMs: 100, kind: "hit", target: "b", by: "a", item: "bomb" },
    { eventId: 2, atMs: 200, kind: "hit", target: "c", by: "b", item: "tennis" },
    { eventId: 3, atMs: 300, kind: "shield", target: "b", by: "c", item: "homing" },
    { eventId: 4, atMs: 400, kind: "hit", target: "c", by: "a", item: "tennis" },
  ]);
  expect(selfHitCues(view, seen)).toEqual([
    { eventId: 1, kind: "hit", text: "Hit by Amina's bomb!" },
    { eventId: 2, kind: "landed", text: "You hit Dev!" },
    { eventId: 3, kind: "shield", text: "Shield blocked Dev's homing bolt!" },
  ]);
  expect(selfHitCues(view, seen)).toEqual([]);
});

it("says your own item when you hit yourself, and stays quiet without item rules v2", () => {
  const own = race([{ eventId: 7, atMs: 1, kind: "hit", target: "b", by: "b" }]);
  expect(selfHitCues(own, new Set())[0]?.text).toBe("Hit by your own item!");
  const legacy = {
    ...race([]),
    presentation: { version: 1 },
  } as unknown as KartRaceView;
  expect(selfHitCues(legacy, new Set())).toEqual([]);
  expect(itemWord(undefined)).toBe("item");
});

it("builds projector ticker lines for landed items only", () => {
  expect(
    hitTickerLines(
      race([
        { eventId: 1, atMs: 1, kind: "hit", target: "b", by: "a", item: "bomb" },
        { eventId: 2, atMs: 2, kind: "shield", target: "c", by: "a", item: "tennis" },
      ]),
    ),
  ).toEqual([{ eventId: 1, text: "Amina 💣 Chen" }]);
});
