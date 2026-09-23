import { describe, expect, it } from "vitest";
import {
  demoQuestions,
  type DuelQuestion,
  type FinaleQuestion,
} from "../src/questions/demo-set.ts";
import {
  assertDuelQuestion,
  awardsForPrediction,
  leadersTied,
  pairIds,
  resolvePair,
  visiblePairs,
} from "../src/questions/duel.ts";

const clash = demoQuestions.find((question) => question.id === "clash");
if (!clash || clash.kind !== "duel") {
  throw new Error("The demo clash question is missing.");
}

describe("duel scoring", () => {
  it("keeps a seeded pairing and gives the odd player a solo target", () => {
    const even = pairIds(["a", "b", "c", "d"], "seed-a");
    expect(even).toHaveLength(2);
    expect(even.every((pair) => pair.rightId)).toBe(true);
    expect(new Set(even.flatMap((pair) => [pair.leftId, pair.rightId])).size).toBe(4);
    expect(pairIds(["a", "b", "c", "d"], "seed-a")).toEqual(even);

    const odd = pairIds(["a", "b", "c"], "seed-b");
    expect(odd.filter((pair) => pair.rightId === null)).toHaveLength(1);
    expect(
      new Set(odd.flatMap((pair) => [pair.leftId, pair.rightId].filter(Boolean))).size,
    ).toBe(3);
    expect(pairIds(["a", "b", "c"], "seed-b")).toEqual(odd);
  });

  it("treats equal distances as a shared win and a missing opponent as a forfeit", () => {
    expect(leadersTied([4, 4, 1])).toBe(true);
    expect(leadersTied([5, 4])).toBe(false);
    expect(leadersTied([9])).toBe(false);

    const tied = resolvePair({
      left: { playerId: "left", value: 26, receivedAt: 10 },
      right: { playerId: "right", value: 26, receivedAt: 90 },
      target: 26,
      within: 2,
      points: clash.points,
    });
    expect(tied).toEqual([
      { playerId: "left", points: 50, detail: "tie" },
      { playerId: "right", points: 50, detail: "tie" },
    ]);

    expect(
      resolvePair({
        left: { playerId: "left", value: 0, receivedAt: 1 },
        right: { playerId: "right", value: null, receivedAt: null },
        target: 26,
        within: 2,
        points: 50,
      }),
    ).toEqual([
      { playerId: "left", points: 50, detail: "win" },
      { playerId: "right", points: 0, detail: "missing" },
    ]);
    expect(
      resolvePair({
        left: { playerId: "left", value: null, receivedAt: null },
        right: { playerId: "right", value: null, receivedAt: null },
        target: 26,
        within: 2,
        points: 50,
      }).every((award) => award.points === 0 && award.detail === "missing"),
    ).toBe(true);

    expect(
      resolvePair({
        left: { playerId: "solo", value: 24, receivedAt: 1 },
        right: null,
        target: 26,
        within: 2,
        points: 50,
      }),
    ).toEqual([{ playerId: "solo", points: 50, detail: "win" }]);
    expect(
      resolvePair({
        left: { playerId: "solo", value: 23, receivedAt: 1 },
        right: null,
        target: 26,
        within: 2,
        points: 50,
      }),
    ).toEqual([{ playerId: "solo", points: 0, detail: "miss" }]);

    const loser = resolvePair({
      left: { playerId: "left", value: 26, receivedAt: 1 },
      right: { playerId: "right", value: 0, receivedAt: 1 },
      target: 26,
      within: 2,
      points: clash.points,
    });
    expect(loser[1]).toEqual({ playerId: "right", points: 0, detail: "miss" });
    expect(loser[0]?.points).toBe(clash.points);
    expect(loser.some((award) => award.points < 0)).toBe(false);
  });

  it("pays a correct prediction and rejects a dropped odd player", () => {
    expect(
      awardsForPrediction({
        predictionPoints: 30,
        winnerIds: ["amina"],
        predictions: [
          { playerId: "chen", contestantId: "amina" },
          { playerId: "dara", contestantId: "bilal" },
        ],
        spectatorIds: ["chen", "dara", "esha"],
      }),
    ).toEqual([
      { playerId: "chen", points: 30, detail: "win" },
      { playerId: "dara", points: 0, detail: "miss" },
      { playerId: "esha", points: 0, detail: "missing" },
    ]);
    expect(
      awardsForPrediction({
        predictionPoints: 30,
        winnerIds: ["amina", "bilal"],
        predictions: [{ playerId: "chen", contestantId: "bilal" }],
        spectatorIds: ["chen"],
      })[0],
    ).toEqual({ playerId: "chen", points: 30, detail: "tie" });
    expect(
      awardsForPrediction({
        predictionPoints: 30,
        winnerIds: [],
        predictions: [{ playerId: "chen", contestantId: "amina" }],
        spectatorIds: ["chen"],
      })[0]?.detail,
    ).toBe("missing");

    expect(
      visiblePairs(
        Array.from({ length: 40 }, (_, index) => index),
        8,
      ),
    ).toHaveLength(8);
    expect(() =>
      assertDuelQuestion({ ...clash, odd: "drop" } as unknown as DuelQuestion),
    ).toThrow(/not dropped/);
    expect(() =>
      assertDuelQuestion({ ...clash, tie: "split" } as unknown as DuelQuestion),
    ).toThrow(/each winner/);
    expect(() =>
      assertDuelQuestion({ ...clash, absence: "wait" } as unknown as DuelQuestion),
    ).toThrow(/forfeits/);
    const finale = demoQuestions.find((question) => question.id === "finale");
    expect(finale?.kind).toBe("finale");
    if (finale?.kind === "finale") {
      assertDuelQuestion(finale satisfies FinaleQuestion);
    }
  });
});
