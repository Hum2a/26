import { describe, expect, it } from "vitest";
import { bubbleLimit, newVoters, visibleVoters, voteShares } from "@26/shared";
import { showsVoters } from "../src/questions/voters.ts";

const a = "00000000-0000-4000-8000-00000000000a";
const b = "00000000-0000-4000-8000-00000000000b";
const c = "00000000-0000-4000-8000-00000000000c";

describe("vote board numbers", () => {
  it("sizes options by share and against the leader, in the question's order", () => {
    const shares = voteShares(
      ["x", "y", "z"],
      [
        { optionId: "y", playerIds: [a, b] },
        { optionId: "x", playerIds: [c] },
        { optionId: "z", playerIds: [] },
      ],
    );
    expect(shares.map((row) => row.optionId)).toEqual(["x", "y", "z"]);
    expect(shares.map((row) => row.count)).toEqual([1, 2, 0]);
    expect(shares[1]).toMatchObject({ share: 2 / 3, grow: 1, leading: true });
    expect(shares[0]).toMatchObject({ share: 1 / 3, grow: 0.5, leading: false });
    expect(shares[2]).toMatchObject({ share: 0, grow: 0, leading: false });
  });

  it("lets every tied option lead, and nobody lead an empty board", () => {
    const tied = voteShares(["x", "y"], [
      { optionId: "x", playerIds: [a] },
      { optionId: "y", playerIds: [b] },
    ]);
    expect(tied.every((row) => row.leading)).toBe(true);
    const empty = voteShares(["x", "y"], null);
    expect(empty.some((row) => row.leading)).toBe(false);
    expect(empty.every((row) => row.share === 0 && row.grow === 0)).toBe(true);
  });

  it("falls back to a reveal tally when names are not on screen, and ignores duplicate ids", () => {
    const counted = voteShares(["x", "y"], null, [
      { optionId: "x", count: 3 },
      { optionId: "y", count: 1 },
    ]);
    expect(counted.map((row) => [row.count, row.playerIds.length])).toEqual([
      [3, 0],
      [1, 0],
    ]);
    const named = voteShares(["x"], [{ optionId: "x", playerIds: [a, a, b] }]);
    expect(named[0]?.count).toBe(2);
  });

  it("keeps the newest voters visible and folds the rest into a count", () => {
    expect(visibleVoters([a, b, c], 2)).toEqual({ shown: [b, c], overflow: 1 });
    expect(visibleVoters([a], 6)).toEqual({ shown: [a], overflow: 0 });
    expect(bubbleLimit(2)).toBe(36);
    expect(bubbleLimit(16)).toBe(6);
    expect(bubbleLimit(1)).toBe(40);
  });

  it("finds voters who arrived or moved since the last board", () => {
    const before = [{ optionId: "x", playerIds: [a] }];
    const after = [
      { optionId: "x", playerIds: [] },
      { optionId: "y", playerIds: [a, b] },
    ];
    expect([...newVoters(before, after)].sort()).toEqual([a, b].sort());
    expect(newVoters(after, after).size).toBe(0);
  });
});

describe("when picks reach a screen", () => {
  const live = { attribution: "live" as const, outcome: { kind: "correct" } };
  const after = { attribution: "after" as const, outcome: { kind: "correct" } };
  const never = { attribution: "never" as const, outcome: { kind: "poll" } };

  it("never sends picks to guest phones", () => {
    expect(showsVoters(live, "collect", "guest", "question")).toBe(false);
    expect(showsVoters(live, "reveal", "guest", "question")).toBe(false);
  });

  it("follows the question's attribution for the stage and host", () => {
    expect(showsVoters(live, "prompt", "stage", "question")).toBe(false);
    expect(showsVoters(live, "collect", "stage", "question")).toBe(true);
    expect(showsVoters(live, "reveal", "control", "question")).toBe(true);
    expect(showsVoters(after, "collect", "stage", "question")).toBe(false);
    expect(showsVoters(after, "reveal", "stage", "question")).toBe(true);
    expect(showsVoters(never, "reveal", "stage", "question")).toBe(false);
  });

  it("lets the host switch hide every question, and leaves push-your-luck to its own ladder", () => {
    expect(showsVoters(live, "collect", "stage", "hidden")).toBe(false);
    expect(
      showsVoters(
        { attribution: "live", outcome: { kind: "push" } },
        "collect",
        "stage",
        "question",
      ),
    ).toBe(false);
  });
});
