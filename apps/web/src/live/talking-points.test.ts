import { describe, expect, it } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { talkingPoints } from "./talking-points";

const amina = "00000000-0000-4000-8000-000000000001";
const sam = "00000000-0000-4000-8000-000000000002";
const bilal = "00000000-0000-4000-8000-000000000003";

function snapshot(extra: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return {
    gameId: "ABCDEFGH",
    joinCode: "ABCDEF",
    phase: "collect",
    paused: false,
    held: false,
    deadlineAt: 10_000,
    remainingMs: 8_000,
    serverNow: 2_000,
    stateVersion: 1,
    questionSetVersion: "demo-2026-09-22",
    scoringVersion: "demo-2026-09-22",
    players: [
      { playerId: amina, nickname: "Amina" },
      { playerId: sam, nickname: "Sam" },
      { playerId: bilal, nickname: "Bilal" },
    ],
    play: {
      question: {
        id: "test-question",
        index: 4,
        total: 12,
        prompt: "Who said it?",
        points: 80,
        illustrative: false,
        attribution: "never",
        presentation: "standard",
        kind: "choice",
        speedBonus: false,
        modifiers: [],
        suppressSpeedBonus: false,
        options: [
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
        ],
      },
      submissionCount: 1,
      selfAnswer: null,
      selfBallot: null,
      ballot: null,
      duel: null,
      reveal: null,
      selfAward: null,
      selfStanding: null,
      standings: [
        { place: 1, nickname: "Amina", points: 120 },
        { place: 2, nickname: "Bilal", points: 118 },
        { place: 3, nickname: "Sam", points: 40 },
      ],
      liveSample: ["Amina"],
      attributions: null,
      explanation: null,
    },
    nextQuestion: { title: "Ed or Humza?", kind: "rank" },
    adminPlayers: [
      {
        playerId: amina,
        nickname: "Amina",
        points: 120,
        connected: true,
        removed: false,
        answered: true,
      },
      {
        playerId: sam,
        nickname: "Sam",
        points: 40,
        connected: true,
        removed: false,
        answered: false,
      },
      {
        playerId: bilal,
        nickname: "Bilal",
        points: 118,
        connected: false,
        removed: false,
        answered: false,
      },
    ],
    highlights: [
      {
        id: "agreement",
        factId: "agreement",
        illustrative: false,
        display: "eligible",
        stage: "The room split almost evenly.",
        results: "The room split almost evenly.",
      },
    ],
    cloud: [],
    namesReveal: null,
    stageHidden: false,
    finishAfterRound: false,
    revealNonce: 0,
    media: [],
    trolls: {
      token: "ready",
      cooldownUntil: null,
      offers: [],
      active: [],
      announcement: null,
    },
    ...extra,
  } as LobbySnapshot;
}

describe("talkingPoints", () => {
  it("names the round, who is still thinking, the top three and the closest race", () => {
    const points = talkingPoints(snapshot());
    expect(points.roundLine).toBe("Round 4 of 12");
    expect(points.nextLine).toBe("Coming up: Ed or Humza?");
    expect(points.phaseLine).toBe("Answers open");
    expect(points.answeredLine).toBe("1 of 2 answered");
    expect(points.waiting.map((guest) => guest.nickname)).toEqual(["Sam"]);
    expect(points.answered.map((guest) => guest.nickname)).toEqual(["Amina"]);
    expect(points.top.map((row) => `${row.place} ${row.nickname}`)).toEqual([
      "1 Amina",
      "2 Bilal",
      "3 Sam",
    ]);
    expect(points.closest).toEqual({ ahead: "Amina", behind: "Bilal", gap: 2 });
    expect(points.highlights).toEqual(["The room split almost evenly."]);
    expect(points.recent).toEqual(["Amina"]);
  });

  it("falls back to public standings when the host roster is absent", () => {
    const points = talkingPoints(snapshot({ adminPlayers: undefined }));
    expect(points.waiting).toEqual([]);
    expect(points.top[0]).toMatchObject({ nickname: "Amina", points: 120, place: 1 });
    expect(points.closest?.gap).toBe(2);
  });
});
