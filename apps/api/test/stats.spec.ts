import { describe, expect, it } from "vitest";
import {
  aggregateFacts,
  factFigures,
  factsForWording,
  presentStats,
  type StatsAnswer,
  type StatsPlayer,
  type StatsSource,
  type StatFact,
} from "../src/stats/aggregate.ts";

describe("factual statistics", () => {
  it("projects shared facts exactly like fresh aggregation for every audience", () => {
    const model = source({
      players: [guest("a", "Amina", "iphone"), guest("b", "Bilal", "android")],
    });
    const facts = aggregateFacts(model);
    const before = JSON.stringify(facts);
    for (const place of ["preview", "stage", "recap"] as const) {
      for (const playerId of [undefined, "a", "b"]) {
        expect(presentStats(model, place, playerId, facts)).toEqual(
          presentStats(model, place, playerId),
        );
      }
    }
    expect(JSON.stringify(facts)).toBe(before);
  });
  it("counts classified devices once and keeps unknown guests visible", () => {
    const facts = aggregateFacts(
      source({
        players: [
          guest("a", "Amina", "iphone", { classification: "ambiguous" }),
          guest("b", "Bilal", "iphone"),
          guest("c", "Chen", "iphone"),
          guest("d", "Dina", "iphone"),
          guest("e", "Eve", "iphone"),
          guest("f", "Farah", "iphone"),
          guest("g", "Gus", "android"),
          guest("h", "Hana", "android"),
          guest("i", "Idris", null),
          guest("j", "Jules", "unknown"),
          guest("k", "Load", "iphone", { clientClass: "synthetic" }),
        ],
      }),
    );
    const iphone = fact(facts, "device-family:iphone");
    expect(iphone).toMatchObject({
      sourceRevision: 4,
      numerator: 6,
      denominator: 8,
      unknownCount: 2,
      display: "eligible",
    });
    expect(iphone.parts).toContainEqual({ label: "ambiguous", count: 1 });
    expect(iphone.parts).toContainEqual({ label: "percent", count: 75 });
    expect(fact(facts, "device-family:android").numerator).toBe(2);
    expect(facts.some((row) => row.id.includes("Load"))).toBe(false);
    const card = cards(
      source({
        players: [
          guest("a", "Amina", "iphone", { classification: "ambiguous" }),
          guest("b", "Bilal", "iphone"),
          guest("c", "Chen", "iphone"),
          guest("d", "Dina", "iphone"),
          guest("e", "Eve", "iphone"),
          guest("f", "Farah", "iphone"),
          guest("g", "Gus", "android"),
          guest("h", "Hana", "android"),
          guest("i", "Idris", null),
          guest("j", "Jules", "unknown"),
          guest("k", "Load", "iphone", { clientClass: "synthetic" }),
        ],
      }),
    ).find((row) => row.factId === "device-family:iphone");
    expect(card?.stage).toContain("6 of the 8");
    expect(card?.results).toContain("2 players had a device we could not classify");
    expect(card?.results).toContain("1 of those classifications is ambiguous");
    expect(card?.results).toContain("75%");
    expect(card?.stage.startsWith("Illustrative.")).toBe(true);
    expect(numbersCovered(card?.stage ?? "", card?.results ?? "", iphone)).toBe(true);
  });

  it("separates who chose an answer from which group was more likely to choose it", () => {
    const players = [...group("iphone", 10), ...group("android", 5, 10)];
    const answers = [
      ...players.slice(0, 5).map((player) => choice(player, "circle", "Circle")),
      ...players.slice(5, 10).map((player) => choice(player, "square", "Square")),
      ...players.slice(10, 14).map((player) => choice(player, "circle", "Circle")),
      choice(players[14]!, "square", "Square"),
    ];
    const built = source({
      players,
      questions: [
        question(
          "shape",
          "Shape",
          players.map((player) => player.playerId),
        ),
      ],
      answers,
    });
    const facts = aggregateFacts(built);
    const composition = facts.find((row) => row.metric === "answer-composition");
    expect(composition).toMatchObject({
      numerator: 5,
      denominator: 9,
      display: "eligible",
      labels: ["Shape", "Circle", "iphone"],
    });
    const likelihood = facts.filter(
      (row) => row.metric === "answer-likelihood" && row.labels[1] === "Circle",
    );
    expect(likelihood.map((row) => row.labels[2])).toEqual(["android"]);
    expect(likelihood[0]).toMatchObject({
      numerator: 4,
      denominator: 5,
      display: "eligible",
    });
    expect(likelihood[0]?.parts).toContainEqual({ label: "othersChose", count: 5 });
    expect(likelihood[0]?.parts).toContainEqual({ label: "othersAnswered", count: 10 });
    const text = cards(built)
      .map((card) => card.stage)
      .join(" ");
    expect(text).toContain("Most people who chose Circle had joined on iPhones");
    expect(text).toContain("more likely to choose Circle");
    expect(text).toContain("Android phones");
    expect(text).not.toContain("iPhones were more likely to choose Circle");
    expect(text).not.toContain("caused");
  });

  it("suppresses a percentage when a group is smaller than five and still shows the counts", () => {
    const players = [...group("iphone", 4), ...group("android", 2, 4)];
    const answers = [
      ...players.slice(0, 3).map((player) => choice(player, "circle", "Circle")),
      choice(players[3]!, "square", "Square"),
      choice(players[4]!, "circle", "Circle"),
      choice(players[5]!, "square", "Square"),
    ];
    const built = source({
      players,
      questions: [
        question(
          "shape",
          "Shape",
          players.map((player) => player.playerId),
        ),
      ],
      answers,
    });
    const row = aggregateFacts(built).find(
      (item) => item.metric === "answer-likelihood" && item.labels[1] === "Circle",
    );
    expect(row?.display).toBe("suppressed");
    expect(row).toMatchObject({ numerator: 3, denominator: 4 });
    const preview = presentStats(built, "preview").highlights ?? [];
    const stage = presentStats(built, "stage").highlights ?? [];
    const card = preview.find((item) => item.factId.startsWith("likelihood:"));
    expect(card?.stage).toContain("3 of 4");
    expect(card?.stage).toContain("1 of 2");
    expect(card?.stage).toContain("at least 5");
    expect(card?.stage).not.toContain("%");
    expect(stage.some((item) => item.factId.startsWith("likelihood:"))).toBe(false);
    expect(numbersCovered(card?.stage ?? "", card?.results ?? "", row!)).toBe(true);
  });

  it("keeps tied splits, a transferred device, a late joiner, and a duplicate response", () => {
    const tied = source({
      players: group("iphone", 6),
      questions: [
        question("one", "One", ["p0", "p1", "p2", "p3"]),
        question("two", "Two", ["p0", "p1", "p2", "p3", "p4", "p5"]),
      ],
      answers: [
        choice(guest("p0", "A", "iphone"), "circle", "Circle", "one"),
        choice(guest("p1", "B", "iphone"), "square", "Square", "one"),
        choice(guest("p2", "C", "iphone"), "circle", "Circle", "one"),
        choice(guest("p3", "D", "iphone"), "square", "Square", "one"),
        choice(guest("p0", "A", "iphone"), "circle", "Circle", "two"),
        choice(guest("p1", "B", "iphone"), "circle", "Circle", "two"),
        choice(guest("p2", "C", "iphone"), "circle", "Circle", "two"),
        choice(guest("p3", "D", "iphone"), "square", "Square", "two"),
        choice(guest("p4", "E", "iphone"), "square", "Square", "two"),
        choice(guest("p5", "F", "iphone"), "square", "Square", "two"),
      ],
    });
    const splits = aggregateFacts(tied).filter((row) => row.metric === "divisive");
    expect(splits.map((row) => row.numerator)).toEqual([0, 0]);
    const splitCards = cards(tied).filter((card) =>
      card.factId.startsWith("divisive:"),
    );
    expect(splitCards.map((card) => card.factId).sort()).toEqual([
      "divisive:one",
      "divisive:two",
    ]);

    const moved = guest("a", "Amina", "iphone");
    const transferred = source({
      players: [moved, guest("b", "Bilal", "android")],
      questions: [question("shape", "Shape", ["a", "b"])],
      answers: [
        { ...choice(moved, "circle", "Circle"), family: "android" },
        choice(guest("b", "Bilal", "android"), "square", "Square"),
      ],
    });
    expect(fact(aggregateFacts(transferred), "device-family:iphone").numerator).toBe(1);
    expect(
      aggregateFacts(transferred).some(
        (row) => row.metric === "answer-composition" && row.labels.includes("android"),
      ),
    ).toBe(true);

    const late = source({
      players: [
        guest("a", "Amina", "iphone"),
        guest("b", "Bilal", "iphone"),
        guest("c", "Chen", "iphone"),
      ],
      questions: [question("shape", "Shape", ["a", "b"])],
      answers: [
        choice(guest("a", "Amina", "iphone"), "circle", "Circle"),
        choice(guest("a", "Amina", "iphone"), "square", "Square"),
      ],
    });
    expect(fact(aggregateFacts(late), "distribution:shape")).toMatchObject({
      numerator: 1,
      denominator: 1,
      unknownCount: 1,
    });
  });

  it("names every tied fastest answer and does not invent a winner from reconnects", () => {
    const players = [
      guest("a", "Amina", "iphone", { reconnects: 4 }),
      guest("b", "Bilal", "android", { reconnects: 9 }),
      guest("c", "Chen", "desktop", { reconnects: 1 }),
    ];
    const built = source({
      complete: true,
      players,
      questions: [question("shape", "Shape", ["a", "b", "c"])],
      revealedQuestionIds: ["shape"],
      answers: [
        {
          ...choice(players[0]!, "circle", "Circle"),
          correct: true,
          timed: true,
          remainingMs: 18_000,
        },
        {
          ...choice(players[1]!, "circle", "Circle"),
          correct: true,
          timed: true,
          remainingMs: 18_000,
        },
        {
          ...choice(players[2]!, "circle", "Circle"),
          correct: true,
          timed: true,
          remainingMs: 1_000,
        },
      ],
      scores: [
        { playerId: "a", points: 100 },
        { playerId: "b", points: 40 },
        { playerId: "c", points: 10 },
      ],
    });
    const fastest = fact(aggregateFacts(built), "fastest:shape");
    expect(fastest.labels).toEqual(["Shape", "Amina", "Bilal"]);
    expect(fastest.numerator).toBe(18_000);
    expect(fastest.denominator).toBe(3);
    expect(fastest.parts).toContainEqual({ label: "seconds", count: 18 });
    const winner = fact(aggregateFacts(built), "reconnect-winner");
    expect(winner.parts).toEqual([{ label: "Amina", count: 4 }]);
    expect(winner.denominator).toBe(3);
    const preview = presentStats(built, "preview").highlights ?? [];
    expect(preview.some((card) => card.stage.includes("Amina and Bilal tied"))).toBe(
      true,
    );
    expect(preview.some((card) => card.stage.includes("reconnected 4 times"))).toBe(
      true,
    );
    const hidden =
      presentStats({ ...built, revealedQuestionIds: [] }, "stage").highlights ?? [];
    expect(hidden.some((card) => card.factId === "fastest:shape")).toBe(false);
    const recap = presentStats(built, "recap", "b").recap ?? [];
    expect(recap.every((card) => card.factId.startsWith("player:b:"))).toBe(true);
    expect(recap.some((card) => card.results.includes("Amina"))).toBe(false);
    expect(recap.some((card) => card.results.includes("Your fastest correct"))).toBe(
      true,
    );
    const privateFacts = aggregateFacts(built).filter((row) => row.scope === "player");
    expect(
      preview.every((card) => !privateFacts.some((row) => row.id === card.factId)),
    ).toBe(true);
  });

  it("withholds empty comparisons and refuses sample numbers", () => {
    const empty = source({
      players: [guest("a", "Amina", null), guest("b", "Bilal", null)],
      questions: [question("shape", "Shape", ["a", "b"])],
    });
    const row = fact(aggregateFacts(empty), "distribution:shape");
    expect(row).toMatchObject({ numerator: 0, denominator: 0, display: "withheld" });
    const shown = JSON.stringify(presentStats(empty, "preview"));
    expect(shown).not.toContain("31 of the 48");
    expect(shown).not.toContain("%");
    const wording = factsForWording(aggregateFacts(empty));
    expect(JSON.stringify(wording)).not.toContain("userAgent");
    expect(JSON.stringify(wording)).not.toContain("203.0.113.8");
    const plain = presentStats(
      {
        ...empty,
        illustrative: false,
        answers: [choice(guest("a", "Amina", null), "circle", "Circle")],
      },
      "preview",
    );
    expect(plain.highlights?.[0]?.illustrative).toBe(false);
    expect(plain.highlights?.[0]?.stage.startsWith("Illustrative.")).toBe(false);
  });

  it("uses the fixed screen cutoff and the shared favourite only when both groups are large enough", () => {
    const players = [...group("iphone", 10), ...group("android", 10, 10)];
    const shape = players.map((player, index) => ({
      ...choice(
        player,
        index < 8 || (index >= 10 && index < 17) ? "circle" : "square",
        index < 8 || (index >= 10 && index < 17) ? "Circle" : "Square",
      ),
      screenGroup: index < 10 ? ("wider" as const) : ("narrower" as const),
    }));
    const colour = players.map((player, index) =>
      choice(
        player,
        index % 10 < 6 ? "blue" : "red",
        index % 10 < 6 ? "Blue" : "Red",
        "colour",
      ),
    );
    const built = source({
      players,
      questions: [
        question(
          "shape",
          "Shape",
          players.map((player) => player.playerId),
        ),
        question(
          "colour",
          "Colour",
          players.map((player) => player.playerId),
        ),
      ],
      answers: [...shape, ...colour],
    });
    const facts = aggregateFacts(built);
    const screen = facts.find(
      (row) => row.metric === "screen-likelihood" && row.labels[2] === "wider",
    );
    expect(screen).toMatchObject({
      numerator: 8,
      denominator: 10,
      display: "eligible",
    });
    expect(screen?.parts).toContainEqual({ label: "widerShortEdgeCss", count: 700 });
    const screenCard = cards(built).find((card) => card.factId.startsWith("screen:"));
    expect(screenCard?.results).toContain("700");
    expect(screenCard?.results).toContain("not inches");
    expect(screenCard?.stage).not.toContain("big phone");
    const agreements = facts.filter((row) => row.metric === "agreement");
    expect(agreements.map((row) => row.scopeId).sort()).toEqual(["colour", "shape"]);
    const agreementCard = cards(built).find((card) =>
      card.factId.startsWith("agreement:"),
    );
    expect(agreementCard?.factId).toContain("shape");
    expect(agreementCard?.results).toContain("8 of 10");
    expect(agreementCard?.results).toContain("7 of 10");
    expect(
      numbersCovered(
        agreementCard?.stage ?? "",
        agreementCard?.results ?? "",
        fact(facts, agreementCard?.factId ?? ""),
      ),
    ).toBe(true);
    expect(
      numbersCovered(screenCard?.stage ?? "", screenCard?.results ?? "", screen!),
    ).toBe(true);
  });

  it("counts each accepted troll once and ignores a refund", () => {
    const built = source({
      players: [guest("a", "Amina", "iphone"), guest("b", "Bilal", "android")],
      trolls: [
        troll("1", "a", "b", "call", "Call from Mum"),
        troll("2", "a", "b", "call", "Call from Mum"),
        troll("3", "b", "a", "crack", "Cracked screen"),
        troll("4", "b", "a", "crack", "Cracked screen"),
        troll("5", "a", "b", "call", "Call from Mum", true),
        troll("1", "a", "b", "call", "Call from Mum"),
      ],
    });
    const row = fact(aggregateFacts(built), "troll-popular");
    expect(row.numerator).toBe(2);
    expect(row.denominator).toBe(4);
    expect(row.labels.sort()).toEqual(["Call from Mum", "Cracked screen"]);
    const recap = presentStats(built, "recap", "a").recap ?? [];
    expect(recap.find((card) => card.factId === "player:a:trolls")?.results).toContain(
      "You sent 2 trolls and 2 were aimed at you",
    );
  });
});

function numbersCovered(stage: string, results: string, row: StatFact): boolean {
  const allowed = new Set(factFigures(row));
  return [...`${stage} ${results}`.matchAll(/\d+/g)].every((match) =>
    allowed.has(Number(match[0])),
  );
}

function cards(built: StatsSource) {
  return presentStats(built, "preview").highlights ?? [];
}

function fact(facts: StatFact[], id: string): StatFact {
  const row = facts.find((item) => item.id === id);
  if (!row) {
    throw new Error(`Missing fact ${id}.`);
  }
  return row;
}

function source(partial: Partial<StatsSource>): StatsSource {
  return {
    gameId: "GAME",
    sourceRevision: 4,
    illustrative: true,
    complete: false,
    players: [],
    questions: [],
    answers: [],
    trolls: [],
    scores: [],
    revealedQuestionIds: [],
    mediaPlayers: [],
    ...partial,
  };
}

function guest(
  playerId: string,
  nickname: string,
  family: string | null,
  extra: Partial<StatsPlayer> = {},
): StatsPlayer {
  return {
    playerId,
    nickname,
    clientClass: "guest",
    family,
    classification: family && family !== "unknown" ? "reported" : "unknown",
    reconnects: 0,
    ...extra,
  };
}

function group(family: string, count: number, start = 0): StatsPlayer[] {
  return Array.from({ length: count }, (_item, index) =>
    guest(`p${start + index}`, `P${start + index}`, family),
  );
}

function question(questionId: string, label: string, eligiblePlayerIds: string[]) {
  return { questionId, label, eligiblePlayerIds };
}

function choice(
  player: StatsPlayer,
  optionId: string,
  optionLabel: string,
  questionId = "shape",
): StatsAnswer {
  return {
    playerId: player.playerId,
    questionId,
    optionId,
    optionLabel,
    correct: false,
    remainingMs: 0,
    timed: false,
    family: player.family,
    screenGroup: null,
  };
}

function troll(
  effectId: string,
  actorId: string,
  targetId: string,
  kind: string,
  label: string,
  refunded = false,
) {
  return { effectId, actorId, targetId, kind, label, refunded };
}
