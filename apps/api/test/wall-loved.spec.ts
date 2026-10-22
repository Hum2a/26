import { describe, expect, it } from "vitest";
import {
  aggregateFacts,
  presentStats,
  wallLovedMinimum,
  type StatsPlayer,
  type StatsSource,
} from "../src/stats/aggregate.ts";

const guest = (playerId: string, nickname: string, extra: Partial<StatsPlayer> = {}): StatsPlayer => ({
  playerId,
  nickname,
  clientClass: "guest",
  family: null,
  classification: null,
  reconnects: 0,
  ...extra,
});

function source(wallPhotos: StatsSource["wallPhotos"]): StatsSource {
  return {
    gameId: "GAME",
    sourceRevision: 1,
    illustrative: false,
    complete: true,
    players: [guest("a", "Amina"), guest("b", "Bilal"), guest("h", "Host", { clientClass: "host" })],
    questions: [],
    answers: [],
    trolls: [],
    scores: [],
    revealedQuestionIds: [],
    mediaPlayers: [],
    wallPhotos,
  };
}

const loved = (input: StatsSource) => aggregateFacts(input).filter((fact) => fact.metric === "wall-loved");

describe("most loved photo", () => {
  it("names the photo with the most reactions on the podium cards", () => {
    const input = source([
      { postId: "p1", playerId: "a", reactions: 12 },
      { postId: "p2", playerId: "b", reactions: 7 },
    ]);
    expect(loved(input)).toEqual([
      expect.objectContaining({ numerator: 12, denominator: 2, labels: ["Amina"] }),
    ]);
    const cards = presentStats(input, "stage").highlights ?? [];
    expect(cards.map((card) => card.stage)).toContain(
      "Most loved photo: Amina's, with 12 reactions.",
    );
  });

  it("gives no award for a tie, too few reactions, or a host photo", () => {
    expect(
      loved(
        source([
          { postId: "p1", playerId: "a", reactions: 9 },
          { postId: "p2", playerId: "b", reactions: 9 },
        ]),
      ),
    ).toEqual([]);
    expect(
      loved(source([{ postId: "p1", playerId: "a", reactions: wallLovedMinimum - 1 }])),
    ).toEqual([]);
    expect(loved(source([{ postId: "p1", playerId: "h", reactions: 50 }]))).toEqual([]);
    expect(loved(source(undefined))).toEqual([]);
  });
});
