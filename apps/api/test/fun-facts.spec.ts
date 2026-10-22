import { funFactCardSchema } from "@26/shared";
import { describe, expect, it } from "vitest";
import {
  funFactFigures,
  selectFunFacts,
  type FunFact,
  type FunFactGuest,
  type FunFactSource,
  type FunFactTraits,
} from "../src/stats/fun-facts.ts";

const blank: FunFactTraits = {
  colorScheme: null,
  browser: null,
  os: null,
  reducedMotion: null,
  orientation: null,
  pointer: null,
  saveData: null,
  screenGroup: null,
  deviceFamily: null,
  language: null,
  timeZone: null,
};

describe("fun facts", () => {
  it("says what share of the room uses dark mode and drops the complement", () => {
    const selected = selectFunFacts(
      source(
        mix([
          ["dark", 6],
          ["light", 4],
        ]),
      ),
    );
    const dark = card(selected.cards, "fun:color:dark");
    expect(dark.text).toBe("60% of you use dark mode.");
    expect(selected.cards.some((item) => item.text.includes("light mode"))).toBe(false);
    expect(dark.text.includes("Amina")).toBe(false);
    expect(covered(selected)).toBe(true);
  });

  it("keeps a lone browser as a count and does not name that guest", () => {
    const selected = selectFunFacts(
      source([
        guest("fox", "Amina", { browser: "firefox" }),
        ...Array.from({ length: 9 }, (_, index) =>
          guest(`c${index}`, `Guest ${index}`, { browser: "chrome" }),
        ),
      ]),
    );
    const firefox = card(selected.cards, "fun:browser:firefox");
    expect(firefox.text).toBe("1 person used Firefox.");
    expect(firefox.text.includes("Amina")).toBe(false);
    expect(selected.facts.find((fact) => fact.id === firefox.id)?.memberIds).toEqual(["fox"]);
    expect(selected.cards.some((item) => item.id === "fun:browser:chrome")).toBe(true);
    expect(covered(selected)).toBe(true);
  });

  it("emits nothing for a device split smaller than three known guests", () => {
    const selected = selectFunFacts(
      source([guest("a", "Amina", { colorScheme: "dark" }), guest("b", "Bilal", { colorScheme: "dark" })]),
    );
    expect(selected.cards).toEqual([]);
  });

  it("ignores unknown values and guests who are not playing", () => {
    const selected = selectFunFacts(
      source([
        guest("fox", "Amina", { browser: "firefox" }),
        ...Array.from({ length: 4 }, (_, index) =>
          guest(`c${index}`, `Chrome ${index}`, { browser: "chrome" }),
        ),
        guest("blank", "Blank", { browser: null }),
        guest("odd", "Odd", { browser: "unknown" }),
        guest("load", "Load", { browser: "firefox" }, { clientClass: "synthetic" }),
        guest("host", "Host", { browser: "firefox" }, { clientClass: "host" }),
      ]),
    );
    const firefox = selected.facts.find((fact) => fact.id === "fun:browser:firefox");
    expect(firefox?.numerator).toBe(1);
    expect(firefox?.memberIds).toEqual(["fox"]);
    expect(selected.cards.some((item) => item.text.includes("Load"))).toBe(false);
    expect(selected.cards.some((item) => item.text.includes("Host"))).toBe(false);
    expect(covered(selected)).toBe(true);
  });

  it("does not name a unique time zone, and does name a zone shared by two people", () => {
    const alone = selectFunFacts(
      source([
        ...Array.from({ length: 5 }, (_, index) =>
          guest(`lon${index}`, `London ${index}`, { timeZone: "Europe/London" }),
        ),
        guest("away", "Away", { timeZone: "America/New_York" }),
      ]),
    );
    const other = card(alone.cards, "fun:zone:other");
    expect(other.text).toBe("1 person was in another time zone.");
    expect(other.text.includes("New York")).toBe(false);
    expect(other.text.includes("London")).toBe(false);

    const pair = selectFunFacts(
      source([
        ...Array.from({ length: 5 }, (_, index) =>
          guest(`lon${index}`, `London ${index}`, { timeZone: "Europe/London" }),
        ),
        guest("ny1", "Nia", { timeZone: "America/New_York" }),
        guest("ny2", "Noor", { timeZone: "America/New_York" }),
      ]),
    );
    expect(card(pair.cards, "fun:zone:america-new-york").text).toBe(
      "2 of you were on New York time.",
    );
    expect(pair.cards.some((item) => item.text.includes("London"))).toBe(false);
    expect(covered(pair)).toBe(true);
  });

  it("needs two likes and a strict lead before it names a nickname", () => {
    expect(
      selectFunFacts(
        source([guest("sam", "Sam"), guest("mia", "Mia")], {
          likes: [{ voterId: "mia", targetId: "sam" }],
        }),
      ).cards.some((item) => item.id === "fun:like"),
    ).toBe(false);
    expect(
      selectFunFacts(
        source(
          [guest("sam", "Sam"), guest("mia", "Mia"), guest("ali", "Ali"), guest("bea", "Bea")],
          {
            likes: [
              { voterId: "mia", targetId: "sam" },
              { voterId: "ali", targetId: "sam" },
              { voterId: "bea", targetId: "mia" },
              { voterId: "sam", targetId: "mia" },
            ],
          },
        ),
      ).cards.some((item) => item.id === "fun:like"),
    ).toBe(false);
    const selected = selectFunFacts(
      source(
        [guest("sam", "Sam"), guest("mia", "Mia"), guest("ali", "Ali"), guest("bea", "Bea")],
        {
          likes: [
            { voterId: "mia", targetId: "sam" },
            { voterId: "ali", targetId: "sam" },
            { voterId: "bea", targetId: "sam" },
            { voterId: "sam", targetId: "mia" },
          ],
        },
      ),
    );
    expect(card(selected.cards, "fun:like").text).toBe("Sam's nickname got 3 likes.");
    expect(selected.facts.find((fact) => fact.id === "fun:like")?.memberIds).toEqual(["sam"]);
    expect(covered(selected)).toBe(true);
  });

  it("prefixes illustrative rooms and keeps every integer on the fact", () => {
    const selected = selectFunFacts(
      source(
        mix([
          ["dark", 6],
          ["light", 4],
        ]),
        { illustrative: true },
      ),
    );
    expect(card(selected.cards, "fun:color:dark").text).toBe(
      "Illustrative. 60% of you use dark mode.",
    );
    for (const item of selected.cards) {
      expect(funFactCardSchema.safeParse(item).success).toBe(true);
    }
    expect(covered(selected)).toBe(true);
  });

  it("caps the night at ten sentences, keeps the score gap last, and orders ties by id", () => {
    const zones = [
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
      "Foxtrot",
      "Golf",
      "Hotel",
      "India",
      "Juliet",
      "Kilo",
      "Lima",
    ];
    const guests = [
      ...Array.from({ length: 5 }, (_, index) =>
        guest(`home${index}`, `Home ${index}`, { timeZone: "Test/Zulu" }),
      ),
      ...zones.flatMap((zone) => [
        guest(`${zone}-a`, `${zone} A`, { timeZone: `Test/${zone}` }),
        guest(`${zone}-b`, `${zone} B`, { timeZone: `Test/${zone}` }),
      ]),
    ];
    const selected = selectFunFacts(
      source(guests, {
        standings: [
          { playerId: "home0", points: 40 },
          { playerId: "home1", points: 30 },
        ],
      }),
    );
    expect(selected.cards).toHaveLength(10);
    expect(selected.cards.at(-1)?.text).toBe("The top two were 10 points apart.");
    const zoneIds = selected.cards.slice(0, -1).map((item) => item.id);
    expect(zoneIds).toEqual([...zoneIds].sort());
    expect(zoneIds).not.toContain("fun:zone:test-lima");
    const again = selectFunFacts(source(guests));
    expect(again.cards.map((item) => item.id)).toEqual(
      selectFunFacts(source(guests)).cards.map((item) => item.id),
    );
    expect(covered(selected)).toBe(true);
  });

  it("leaves device family to the podium highlight when that card already exists", () => {
    const guests = [
      ...Array.from({ length: 6 }, (_, index) =>
        guest(`phone${index}`, `Phone ${index}`, { deviceFamily: "iphone" }),
      ),
      guest("desk", "Desk", { deviceFamily: "desktop" }),
    ];
    const quiet = selectFunFacts(source(guests, { deviceFamilyHighlighted: true }));
    expect(quiet.cards.some((item) => item.id.startsWith("fun:family:"))).toBe(false);
    const spoken = selectFunFacts(source(guests, { deviceFamilyHighlighted: false }));
    expect(card(spoken.cards, "fun:family:desktop").text).toBe(
      "1 person joined on a desktop.",
    );
    expect(spoken.cards.some((item) => item.id === "fun:family:iphone")).toBe(true);
  });

  it("counts trolls, a liked nickname's absence of dislikes, photos, and a driver", () => {
    const guests = [
      guest("a", "Amina", {}, { driverStyle: "bandit" }),
      guest("b", "Bilal", {}, { driverStyle: "racer" }),
      guest("c", "Chen", {}, { driverStyle: "racer" }),
      guest("d", "Dina", {}, { driverStyle: "racer" }),
      guest("e", "Eve", {}, { driverStyle: "racer" }),
    ];
    const selected = selectFunFacts(
      source(guests, {
        trolls: [
          { actorId: "a", label: "Screen invasion" },
          { actorId: "b", label: "Screen invasion" },
          { actorId: "c", label: "Screen invasion" },
          { actorId: "d", label: "Call from Mum" },
        ],
        media: Array.from({ length: 6 }, () => ({ playerId: "a", kind: "photo" as const })),
        likes: [
          { voterId: "b", targetId: "a" },
          { voterId: "c", targetId: "a" },
        ],
      }),
    );
    expect(card(selected.cards, "fun:trolls").text).toBe("4 trolls were played.");
    expect(card(selected.cards, "fun:troll:screen-invasion").text).toBe(
      "The favourite troll was Screen invasion, sent 3 times.",
    );
    expect(selected.cards.some((item) => item.text.toLowerCase().includes("dislike"))).toBe(
      false,
    );
    expect(card(selected.cards, "fun:media:photo").text).toBe("6 photos made it in.");
    expect(card(selected.cards, "fun:driver:bandit").text).toBe(
      "1 person chose the Bandit driver.",
    );
    expect(covered(selected)).toBe(true);
  });
});

function covered(selected: { facts: FunFact[]; cards: { id: string; text: string }[] }): boolean {
  return selected.cards.every((item) => {
    const fact = selected.facts.find((row) => row.id === item.id);
    if (!fact) {
      return false;
    }
    const allowed = new Set(funFactFigures(fact));
    return [...item.text.matchAll(/\d+/g)].every((match) => allowed.has(Number(match[0])));
  });
}

function card(cards: { id: string; text: string }[], id: string): { id: string; text: string } {
  const found = cards.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing card ${id}.`);
  }
  return found;
}

function source(
  guests: readonly FunFactGuest[],
  extra: Partial<FunFactSource> = {},
): FunFactSource {
  return {
    illustrative: false,
    deviceFamilyHighlighted: true,
    guests,
    trolls: [],
    likes: [],
    media: [],
    standings: [],
    ...extra,
  };
}

function guest(
  playerId: string,
  nickname: string,
  traits: Partial<FunFactTraits> = {},
  extra: Partial<FunFactGuest> = {},
): FunFactGuest {
  return {
    playerId,
    nickname,
    clientClass: "guest",
    traits: { ...blank, ...traits },
    driverStyle: null,
    ...extra,
  };
}

function mix(groups: readonly (readonly ["dark" | "light", number])[]): FunFactGuest[] {
  return groups.flatMap(([scheme, count]) =>
    Array.from({ length: count }, (_, index) =>
      guest(`${scheme}${index}`, `${scheme} ${index}`, { colorScheme: scheme }),
    ),
  );
}
