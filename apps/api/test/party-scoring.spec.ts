import { expect, it } from "vitest";
import {
  commonnessResults,
  consensusRanking,
  estimateAwards,
  passwordKey,
  sameAnswerSet,
} from "../../../packages/shared/src/party-scoring.ts";
import {
  createPartyVoteFlow,
  flowCandidateIds,
  planHeat,
  settleHeat,
  settlePartyVoteFlow,
} from "../../../packages/shared/src/party-scoring.ts";

const shuffled = (ids: string[], turn: number) =>
  ids.map((_, i) => ids[(i * 7 + turn * 13) % ids.length]!);

it("deals every phone five different pairs, never its own entry, and judges entries evenly", () => {
  const ids = Array.from({ length: 80 }, (_, i) => `c${i}`);
  const voters = ids.map((id, i) => ({ playerId: `p${i}`, own: [id] }));
  const rounds = [0, 1, 2, 3, 4].map((turn) => shuffled(ids, turn));
  const plan = planHeat(rounds, voters, 5);
  const seen = new Map<string, number>();
  for (const voter of voters) {
    const pairs = plan[voter.playerId]!;
    expect(pairs).toHaveLength(5);
    expect(pairs.flat()).not.toContain(voter.own[0]);
    const keys = pairs.map((pair) => [...pair].sort().join("|"));
    expect(new Set(keys).size).toBe(5);
    for (const id of pairs.flat()) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const counts = ids.map((id) => seen.get(id) ?? 0);
  expect(Math.min(...counts)).toBeGreaterThanOrEqual(6);
  expect(Math.max(...counts)).toBeLessThanOrEqual(14);
});

it("skips the phone round when the room has no more entries than finalists", () => {
  const ids = ["a", "b", "c", "d"];
  const flow = createPartyVoteFlow("tournament", ids, [], { pairs: 5, finalists: 8 });
  expect(flow.heat).toBeUndefined();
  expect(flowCandidateIds(flow)).toEqual(["a", "b"]);
});

it("sends the best phone-round entries to a knockout numbered from match 1", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  let flow = createPartyVoteFlow("tournament", ids, [], { pairs: 2, finalists: 4 });
  expect(flow.heat).toEqual({ pairs: 2, finalists: 4 });
  expect(flowCandidateIds(flow)).toEqual(ids);
  // A knockout settle cannot close a phone round by mistake.
  expect(settlePartyVoteFlow(flow, ["a"], ids)).toEqual(flow);
  const plan = {
    p1: [
      ["a", "b"],
      ["c", "d"],
    ] as [string, string][],
    p2: [
      ["e", "f"],
      ["a", "c"],
    ] as [string, string][],
    p3: [
      ["b", "d"],
      ["e", "a"],
    ] as [string, string][],
  };
  flow = settleHeat(
    flow,
    [
      { playerId: "p1", pair: 0, candidateId: "a" },
      { playerId: "p1", pair: 1, candidateId: "d" },
      { playerId: "p2", pair: 0, candidateId: "f" },
      { playerId: "p2", pair: 1, candidateId: "a" },
      { playerId: "p3", pair: 0, candidateId: "b" },
      { playerId: "p3", pair: 1, candidateId: "e" },
      // Not one of this phone's pairs: ignored.
      { playerId: "p3", pair: 1, candidateId: "c" },
      // Unknown phone: ignored.
      { playerId: "zz", pair: 0, candidateId: "c" },
    ],
    plan,
    ids,
  );
  // a won 2 of 3, d/f/b won 1 of 1 or 1 of 2, e 1 of 2, c 0 of 2.
  expect(flow.heat).toBeUndefined();
  expect(flow.results[0]).toMatchObject({ label: "Phone round", votes: 6 });
  expect(flow.results[0]!.winners).toEqual(["a", "b", "d", "f"]);
  expect(flow.step).toBe(2);
  expect(flowCandidateIds(flow)).toEqual(["a", "b"]);
  flow = settlePartyVoteFlow(flow, ["b"], ids);
  expect(flow.results.at(-1)!.label).toBe("Match 1");
  flow = settlePartyVoteFlow(flow, ["d"], ids);
  flow = settlePartyVoteFlow(flow, ["b"], ids);
  expect(flow).toMatchObject({ finished: true, winners: ["b"] });
  expect(flow.results.at(-1)!.label).toBe("Match 3");
});

it("still picks finalists from the frozen draw when nobody votes in the phone round", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const flow = settleHeat(
    createPartyVoteFlow("tournament", ids, [], { pairs: 3, finalists: 2 }),
    [],
    {},
    ["b", "c", "d", "e"],
  );
  expect(flow.results[0]!.winners).toEqual(["b", "c"]);
  expect(flowCandidateIds(flow)).toEqual(["b", "c"]);
});

it("runs all three awards over the same entries, preserving ties and independent winners", () => {
  let flow = createPartyVoteFlow(
    "awards",
    ["a", "b", "c"],
    ["Smooth", "Brutal", "Scene"],
  );
  flow = settlePartyVoteFlow(flow, ["a", "a", "b"], ["a", "b", "c"]);
  expect(flow.finished).toBe(false);
  expect(flowCandidateIds(flow)).toEqual(["a", "b", "c"]);
  flow = settlePartyVoteFlow(flow, ["b", "c"], ["a", "b", "c"]);
  flow = settlePartyVoteFlow(flow, [], ["a", "b", "c"]);
  expect(flow.finished).toBe(true);
  expect(flow.results.map((r) => r.winners)).toEqual([["a"], ["b", "c"], []]);
});

it("plays a blind knockout with odd byes, a persisted seeded tie rule and no prize for no votes", () => {
  let flow = createPartyVoteFlow("tournament", ["a", "b", "c", "d", "e"]);
  expect(flowCandidateIds(flow)).toEqual(["a", "b"]);
  flow = settlePartyVoteFlow(flow, ["a", "b"], flow.ids);
  expect(flowCandidateIds(flow)).toEqual(["c", "d"]);
  flow = settlePartyVoteFlow(flow, ["d"], flow.ids);
  expect(flowCandidateIds(flow)).toEqual(["e", "a"]);
  flow = settlePartyVoteFlow(flow, ["e"], flow.ids);
  expect(flowCandidateIds(flow)).toEqual(["d", "e"]);
  flow = settlePartyVoteFlow(flow, ["e"], flow.ids);
  expect(flow).toMatchObject({ finished: true, winners: ["e"] });
  expect(settlePartyVoteFlow(flow, ["d"], flow.ids)).toEqual(flow);
  const empty = createPartyVoteFlow("tournament", ["a", "b"]);
  expect(settlePartyVoteFlow(empty, [], empty.ids).winners).toEqual([]);
  expect(settlePartyVoteFlow(empty, ["a"], ["b"]).winners).toEqual([]);
});

it("matches made-up passwords consistently and awards ties equally without rewarding unique answers", () => {
  expect(passwordKey("  PASSWORD  One ")).toBe("password one");
  const result = commonnessResults(
    [
      { playerId: "a", body: "password" },
      { playerId: "b", body: "PASSWORD" },
      { playerId: "c", body: " password " },
      { playerId: "d", body: "hello" },
      { playerId: "e", body: "hello" },
      { playerId: "f", body: "alone" },
    ],
    100,
  );
  expect(result.map((row) => row.points)).toEqual([100, 100, 100, 50, 50, 0]);
  expect(result.map((row) => row.rank)).toEqual([1, 1, 1, 2, 2, 3]);
  expect(commonnessResults([{ playerId: "a", body: "alone" }], 100)[0]?.points).toBe(0);
});

it("shares the closest-under prize, rejects overbids and gives no prize if everyone goes over", () => {
  const input = {
    mode: "under" as const,
    target: 7.5,
    points: 100,
    minimum: 0,
    maximum: 20,
  };
  expect(estimateAwards({ ...input, values: [7.49, 7.49, 7.51, 5] }).awards).toEqual([
    100, 100, 0, 0,
  ]);
  expect(estimateAwards({ ...input, values: [7.51, 8] }).awards).toEqual([0, 0]);
  expect(estimateAwards({ ...input, values: [] }).awards).toEqual([]);
});

it("uses the room median without inventing a personal target", () => {
  const input = {
    mode: "consensus" as const,
    target: null,
    points: 100,
    minimum: 0,
    maximum: 100,
  };
  expect(estimateAwards({ ...input, values: [0, 40, 100] })).toEqual({
    target: 40,
    awards: [60, 100, 40],
  });
  expect(estimateAwards({ ...input, values: [20, 80] }).target).toBe(50);
  expect(estimateAwards({ ...input, values: [] }).target).toBeNull();
});

it("preserves consensus ties and requires the whole correct answer set", () => {
  expect(
    consensusRanking(
      ["a", "b"],
      ["first", "second"],
      [
        [
          { itemId: "a", tierId: "first" },
          { itemId: "b", tierId: "second" },
        ],
        [
          { itemId: "b", tierId: "first" },
          { itemId: "a", tierId: "second" },
        ],
      ],
    ),
  ).toEqual([{ tierId: "first", itemIds: ["a", "b"] }]);
  expect(sameAnswerSet(["b", "a"], ["a", "b"])).toBe(true);
  expect(sameAnswerSet(["a"], ["a", "b"])).toBe(false);
  expect(sameAnswerSet(["a", "a"], ["a", "b"])).toBe(false);
});
