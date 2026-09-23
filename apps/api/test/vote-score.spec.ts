import { describe, expect, it } from "vitest";
import {
  demoQuestions,
  type GuessQuestion,
  type VoteQuestion,
} from "../src/questions/demo-set.ts";
import {
  assertGuessQuestion,
  assertVoteQuestion,
  awardsForBallot,
  cardsForAudience,
  revealSelection,
  shuffleIds,
  stageCardCap,
  winningIds,
} from "../src/questions/vote.ts";

const toast = question("toast", "vote");
const who = question("who", "guess");

describe("room-wide vote and guess scoring", () => {
  it("gives every tied winner the full points", () => {
    const awards = awardsForBallot({
      points: 60,
      mode: "authors",
      winners: ["c1", "c2"],
      candidates: [
        { id: "c1", ownerId: "amina" },
        { id: "c2", ownerId: "bilal" },
      ],
      ballots: [
        { playerId: "amina", candidateId: "c2" },
        { playerId: "bilal", candidateId: "c1" },
      ],
      playerIds: ["amina", "bilal", "chen"],
    });
    expect(awards).toEqual([
      { playerId: "amina", points: 60, detail: "tie" },
      { playerId: "bilal", points: 60, detail: "tie" },
      { playerId: "chen", points: 0, detail: "miss" },
    ]);
    expect(awards[0]?.points).toBe(60);
  });

  it("scores a named guess without using the majority", () => {
    const winners = winningIds({
      scoring: "named",
      truthId: "bilal",
      candidates: [
        { id: "bilal", eligible: true, included: true },
        { id: "amina", eligible: true, included: true },
      ],
      ballots: [
        { candidateId: "amina" },
        { candidateId: "amina" },
        { candidateId: "bilal" },
      ],
    });
    expect(winners).toEqual(["bilal"]);
    expect(
      awardsForBallot({
        points: 80,
        mode: "voters",
        winners,
        candidates: [
          { id: "bilal", ownerId: "bilal" },
          { id: "amina", ownerId: "amina" },
        ],
        ballots: [
          { playerId: "chen", candidateId: "amina" },
          { playerId: "bilal", candidateId: "amina" },
          { playerId: "amina", candidateId: "bilal" },
        ],
        playerIds: ["amina", "bilal", "chen"],
      }),
    ).toEqual([
      { playerId: "amina", points: 80, detail: "win" },
      { playerId: "bilal", points: 0, detail: "miss" },
      { playerId: "chen", points: 0, detail: "miss" },
    ]);
  });

  it("can award a majority when the question says so", () => {
    const winners = winningIds({
      scoring: "majority",
      truthId: null,
      candidates: [
        { id: "bilal", eligible: true, included: true },
        { id: "amina", eligible: true, included: true },
      ],
      ballots: [
        { candidateId: "amina" },
        { candidateId: "amina" },
        { candidateId: "bilal" },
      ],
    });
    expect(winners).toEqual(["amina"]);
    const awards = awardsForBallot({
      points: 80,
      mode: "voters",
      winners,
      candidates: [
        { id: "bilal", ownerId: "bilal" },
        { id: "amina", ownerId: "amina" },
      ],
      ballots: [
        { playerId: "chen", candidateId: "amina" },
        { playerId: "bilal", candidateId: "amina" },
        { playerId: "amina", candidateId: "bilal" },
      ],
      playerIds: ["amina", "bilal", "chen", "dara"],
    });
    expect(awards.find((award) => award.playerId === "chen")?.points).toBe(80);
    expect(awards.find((award) => award.playerId === "bilal")?.points).toBe(80);
    expect(awards.find((award) => award.playerId === "amina")?.points).toBe(0);
    expect(awards.find((award) => award.playerId === "dara")).toEqual({
      playerId: "dara",
      points: 0,
      detail: "missing",
    });
  });

  it("scores nothing when nobody votes or the question is unscored", () => {
    expect(
      winningIds({
        scoring: "tally",
        truthId: null,
        candidates: [{ id: "c1", eligible: true, included: true }],
        ballots: [],
      }),
    ).toEqual([]);
    expect(
      awardsForBallot({
        points: 60,
        mode: "authors",
        winners: [],
        candidates: [{ id: "c1", ownerId: "amina" }],
        ballots: [],
        playerIds: ["amina"],
      }),
    ).toEqual([{ playerId: "amina", points: 0, detail: "missing" }]);
    expect(
      awardsForBallot({
        points: 80,
        mode: "none",
        winners: ["bilal"],
        candidates: [{ id: "bilal", ownerId: "bilal" }],
        ballots: [{ playerId: "amina", candidateId: "bilal" }],
        playerIds: ["amina"],
      }),
    ).toEqual([{ playerId: "amina", points: 0, detail: "unscored" }]);
  });

  it("keeps a 75-card reveal to eight and leaves the tally alone", () => {
    const cards = Array.from({ length: 75 }, (_, position) => ({
      id: `c${position}`,
      votes: position,
      position,
    }));
    expect(revealSelection(cards, [], stageCardCap)).toEqual([
      "c74",
      "c73",
      "c72",
      "c71",
      "c70",
      "c69",
      "c68",
      "c67",
    ]);
    expect(revealSelection(cards, ["c1", "c2"], stageCardCap)).toEqual(["c1", "c2"]);
    expect(cardsForAudience("stage", cards)).toEqual([]);
    expect(cardsForAudience("guest", cards)).toHaveLength(75);
    const awards = awardsForBallot({
      points: 60,
      mode: "authors",
      winners: ["c74"],
      candidates: [{ id: "c74", ownerId: "amina" }],
      ballots: [{ playerId: "bilal", candidateId: "c74" }],
      playerIds: ["amina", "bilal"],
    });
    expect(awards.find((award) => award.playerId === "amina")?.points).toBe(60);
    expect(awards.find((award) => award.playerId === "bilal")?.detail).toBe("miss");
  });

  it("rejects a split tie or more than one vote", () => {
    expect(() =>
      assertVoteQuestion({ ...toast, votes: 2 } as unknown as VoteQuestion),
    ).toThrow(/one vote/);
    expect(() =>
      assertVoteQuestion({ ...toast, tie: "split" } as unknown as VoteQuestion),
    ).toThrow(/Tied winners/);
    expect(() =>
      assertGuessQuestion({
        ...who,
        scoring: "majority",
        truthNickname: "Bilal",
      } as GuessQuestion),
    ).toThrow(/named guess/);
  });

  it("keeps a player's shuffle stable", () => {
    const ids = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7"];
    const once = shuffleIds(ids, "seed", "amina");
    expect(shuffleIds(ids, "seed", "amina")).toEqual(once);
    expect([...once].sort()).toEqual([...ids].sort());
  });
});

function question(id: string, kind: "vote"): VoteQuestion;
function question(id: string, kind: "guess"): GuessQuestion;
function question(id: string, kind: "vote" | "guess"): VoteQuestion | GuessQuestion {
  const found = demoQuestions.find((item) => item.id === id && item.kind === kind);
  if (!found || found.kind !== kind) {
    throw new Error(`Missing ${id}.`);
  }
  return found;
}
