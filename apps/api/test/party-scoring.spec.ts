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
  settlePartyVoteFlow,
} from "../../../packages/shared/src/party-scoring.ts";

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
