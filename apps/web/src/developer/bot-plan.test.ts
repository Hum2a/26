import { expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  kartRaceSchema,
  emptyWordleBoard,
} from "@26/shared";
import { playingFixture } from "../admin/controls.test-support";
import { planBot } from "./bot-plan";

it("uses public options and obeys paused, held and accepted states", () => {
  expect(planBot(playingFixture, 0)?.action).toEqual({
    name: "answer",
    optionId: "one",
  });
  expect(planBot(playingFixture, 1)?.action).toEqual({
    name: "answer",
    optionId: "two",
  });
  expect(planBot({ ...playingFixture, paused: true }, 0)).toBeUndefined();
  expect(planBot({ ...playingFixture, held: true }, 0)).toBeUndefined();
  expect(planBot({ ...playingFixture, phase: "reveal" }, 0)).toBeUndefined();
  expect(
    planBot(
      {
        ...playingFixture,
        play: {
          ...playingFixture.play!,
          selfAnswer: { kind: "choice", optionId: "one" },
        },
      },
      0,
    ),
  ).toBeUndefined();
});

it("submits only selectable ballot cards and includes tournament epochs", () => {
  const snapshot = {
    ...playingFixture,
    phase: "vote" as const,
    play: {
      ...playingFixture.play!,
      ballot: {
        reason: "open" as const,
        total: 2,
        epoch: 2,
        cards: [
          { id: "self", label: "Me", own: true, selectable: false, author: null },
          { id: "other", label: "Other", own: false, selectable: true, author: null },
        ],
      },
    },
  };
  expect(planBot(snapshot, 0)).toEqual({
    key: "test-question:vote:2",
    action: { name: "ballot", candidateId: "other", epoch: 2 },
  });
  expect(
    planBot(
      { ...snapshot, play: { ...snapshot.play, selfBallot: { candidateId: "other" } } },
      0,
    ),
  ).toBeUndefined();
  expect(
    planBot(
      {
        ...snapshot,
        play: { ...snapshot.play, ballot: { ...snapshot.play.ballot, reason: "late" } },
      },
      0,
    ),
  ).toBeUndefined();
});

it("keeps slider values on the public scale and sends complete legal rankings", () => {
  const source = playingFixture.play!.question;
  const core = {
    id: source.id,
    index: source.index,
    total: source.total,
    prompt: source.prompt,
    points: source.points,
    illustrative: source.illustrative,
    attribution: source.attribution,
    presentation: source.presentation,
  };
  const slider = {
    ...playingFixture,
    play: {
      ...playingFixture.play!,
      question: {
        ...core,
        kind: "slider" as const,
        minimum: -5,
        maximum: 5,
        step: 0.5,
        initial: 0,
        unit: "cm",
      },
    },
  };
  expect(planBot(slider, 2)?.action).toEqual({ name: "estimate", value: -4 });
  const rank = {
    ...playingFixture,
    play: {
      ...playingFixture.play!,
      question: {
        ...core,
        kind: "rank" as const,
        mode: "complete" as const,
        ties: "forbidden" as const,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        tiers: [
          { id: "first", label: "First" },
          { id: "second", label: "Second" },
        ],
      },
    },
  };
  expect(planBot(rank, 1)?.action).toEqual({
    name: "rank",
    placements: [
      { itemId: "a", tierId: "second" },
      { itemId: "b", tierId: "first" },
    ],
  });
  const partial = {
    ...rank,
    play: {
      ...rank.play,
      question: {
        ...rank.play.question,
        mode: "partial" as const,
        items: [...rank.play.question.items, { id: "c", label: "C" }],
      },
    },
  };
  const planned = planBot(partial, 0)?.action;
  expect(planned?.name).toBe("rank");
  if (planned?.name === "rank") {
    expect(planned.placements).toHaveLength(2);
    expect(new Set(planned.placements.map((item) => item.tierId)).size).toBe(2);
  }
});

it("plays successive public Wordle boards and stops when complete", () => {
  const snapshot = {
    ...playingFixture,
    play: {
      ...playingFixture.play!,
      question: {
        ...playingFixture.play!.question,
        kind: "wordle" as const,
        wordLength: 5 as const,
        maxGuesses: 6 as const,
      },
      selfAnswer: emptyWordleBoard(),
    },
  };
  expect(planBot(snapshot, 0)?.action).toEqual({ name: "text", body: "CRANE" });
  snapshot.play.selfAnswer.guesses.push({
    word: "CRANE",
    marks: ["absent", "absent", "absent", "absent", "absent"],
  });
  expect(planBot(snapshot, 0)?.key).toContain(":1");
  expect(planBot(snapshot, 0)?.action).toEqual({ name: "text", body: "SLATE" });
  snapshot.play.selfAnswer.status = "won";
  expect(planBot(snapshot, 0)).toBeUndefined();
});

it("supports 100 kart participants and rejects the 101st", () => {
  const players = Array.from({ length: 100 }, (_, n) => ({
    playerId: crypto.randomUUID(),
    name: `Bot ${n}`,
  }));
  const race = createKartRace("test", players, {
    seedGrid: true,
    trackId: "mario-circuit-v1",
  });
  expect(race.drivers).toHaveLength(100);
  expect(kartRaceSchema.safeParse(projectKartRace(race, null, 0)).success).toBe(true);
  expect(() =>
    createKartRace("test", [
      ...players,
      { playerId: crypto.randomUUID(), name: "Overflow" },
    ]),
  ).toThrow("100");
});
