import {
  driverStyles,
  funFactCap,
  funFactCardSchema,
  type FunFactCard,
} from "@26/shared";

/**
 * Fun-fact sentences are calculated before they are worded.
 * A sentence may only repeat a number stored on its fact.
 * Device sentences do not name a guest.
 */

export type FunFactTraits = {
  colorScheme: "light" | "dark" | "unknown" | null;
  browser: string | null;
  os: string | null;
  reducedMotion: "reduce" | "no-preference" | "unknown" | null;
  orientation: "portrait" | "landscape" | "unknown" | null;
  pointer: "coarse" | "fine" | "unknown" | null;
  saveData: boolean | null;
  screenGroup: "narrower" | "wider" | "unknown" | null;
  deviceFamily: string | null;
  language: string | null;
  timeZone: string | null;
};

export type FunFactGuest = {
  playerId: string;
  nickname: string;
  clientClass: "guest" | "host" | "test" | "synthetic";
  traits: FunFactTraits | null;
  driverStyle: string | null;
};

export type FunFactSource = {
  illustrative: boolean;
  /** Podium already has a device-family card, so this beat stays quiet about it. */
  deviceFamilyHighlighted: boolean;
  guests: readonly FunFactGuest[];
  trolls: readonly { actorId: string; label: string }[];
  likes: readonly { voterId: string; targetId: string }[];
  media: readonly { playerId: string; kind: "photo" | "voice" }[];
  standings: readonly { playerId: string; points: number }[];
};

export type FunFact = {
  id: string;
  rank: number;
  numerator: number;
  denominator: number;
  unknownCount: number;
  percent: number | null;
  parts: { label: string; count: number }[];
  memberIds: string[];
  sentence: string;
};

export type FunFactSelection = {
  facts: FunFact[];
  cards: FunFactCard[];
};

type Audience = "you" | "phones";
type Shape = "all" | "rare" | "percent";

type Bucket = {
  value: string;
  count: number;
  memberIds: string[];
};

export function selectFunFacts(source: FunFactSource): FunFactSelection {
  const guests = source.guests.filter((guest) => guest.clientClass === "guest");
  const guestIds = new Set(guests.map((guest) => guest.playerId));
  const facts = cap(
    collect({ ...source, guests }).filter((fact) =>
      fact.memberIds.every((id) => guestIds.has(id)),
    ),
  );
  const cards = facts.map((fact) =>
    funFactCardSchema.parse({
      id: fact.id,
      illustrative: source.illustrative,
      text: source.illustrative ? `Illustrative. ${fact.sentence}` : fact.sentence,
    }),
  );
  return { facts, cards };
}

export function funFactFigures(fact: FunFact): number[] {
  return [
    fact.numerator,
    fact.denominator,
    fact.unknownCount,
    ...(fact.percent === null ? [] : [fact.percent]),
    ...fact.parts.map((part) => part.count),
  ];
}

export function funFactApplies(fact: FunFact, playerId: string): boolean {
  return fact.memberIds.includes(playerId);
}

function collect(source: FunFactSource): FunFact[] {
  const guests = source.guests;
  const facts: FunFact[] = [];
  facts.push(
    ...traitFacts({
      id: "color",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.colorScheme ?? null),
      sentence: (value, shape, audience, count, percent) =>
        colorSentence(value, shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "browser",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.browser ?? null),
      sentence: (value, shape, audience, count, percent) =>
        browserSentence(value, shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "os",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.os ?? null),
      sentence: (value, shape, audience, count, percent) =>
        osSentence(value, shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "motion",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.reducedMotion ?? null),
      include: (value) => value === "reduce",
      sentence: (_value, shape, audience, count, percent) =>
        motionSentence(shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "orientation",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.orientation ?? null),
      sentence: (value, shape, audience, count, percent) =>
        orientationSentence(value, shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "pointer",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) => knownText(guest.traits?.pointer ?? null),
      sentence: (value, shape, audience, count, percent) =>
        pointerSentence(value, shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "save-data",
      rankRare: 10,
      rankCommon: 20,
      guests,
      read: (guest) =>
        guest.traits?.saveData === null || guest.traits?.saveData === undefined
          ? null
          : guest.traits.saveData
            ? "on"
            : "off",
      include: (value) => value === "on",
      sentence: (_value, shape, audience, count, percent) =>
        saveDataSentence(shape, audience, count, percent),
    }),
  );
  facts.push(
    ...traitFacts({
      id: "screen",
      rankRare: 30,
      rankCommon: 30,
      guests,
      read: (guest) => knownText(guest.traits?.screenGroup ?? null),
      sentence: (value, shape, audience, count, percent) =>
        screenSentence(value, shape, audience, count, percent),
    }),
  );
  if (!source.deviceFamilyHighlighted) {
    facts.push(
      ...traitFacts({
        id: "family",
        rankRare: 40,
        rankCommon: 40,
        guests,
        read: (guest) => knownText(guest.traits?.deviceFamily ?? null),
        sentence: (value, shape, audience, count, percent) =>
          familySentence(value, shape, audience, count, percent),
      }),
    );
  }
  facts.push(...localeFacts(guests, "language", 50));
  facts.push(...localeFacts(guests, "timeZone", 55));
  facts.push(...trollFacts(source, guests));
  facts.push(...likeFacts(source, guests));
  facts.push(...driverFacts(guests));
  facts.push(...mediaFacts(source, guests));
  const score = scoreFact(source, guests);
  if (score) {
    facts.push(score);
  }
  return facts;
}

function traitFacts(input: {
  id: string;
  rankRare: number;
  rankCommon: number;
  guests: readonly FunFactGuest[];
  read: (guest: FunFactGuest) => string | null;
  include?: (value: string) => boolean;
  sentence: (
    value: string,
    shape: Shape,
    audience: Audience,
    count: number,
    percent: number,
  ) => string;
}): FunFact[] {
  const grouped = group(input.guests, input.read);
  const audience = audienceFor(grouped.unknown, input.guests.length);
  const shapes = shapesFor(grouped.buckets, grouped.known);
  const facts: FunFact[] = [];
  for (const bucket of grouped.buckets) {
    const shape = shapes.get(bucket.value);
    if (!shape || (input.include && !input.include(bucket.value))) {
      continue;
    }
    if (shape !== "rare" && audience === "drop") {
      continue;
    }
    const heard = audience === "drop" ? "you" : audience;
    const percent = share(bucket.count, grouped.known);
    const sentence = input.sentence(bucket.value, shape, heard, bucket.count, percent);
    facts.push(
      make({
        id: `fun:${input.id}:${slug(bucket.value)}`,
        rank: shape === "rare" ? input.rankRare : input.rankCommon,
        numerator: bucket.count,
        denominator: grouped.known,
        unknownCount: grouped.unknown,
        percent: shape === "percent" ? percent : null,
        parts: nicknameDigits(sentence, bucket.count, percent),
        memberIds: bucket.memberIds,
        sentence,
      }),
    );
  }
  return facts;
}

function localeFacts(
  guests: readonly FunFactGuest[],
  field: "language" | "timeZone",
  rank: number,
): FunFact[] {
  const read = (guest: FunFactGuest) =>
    field === "language"
      ? knownText(guest.traits?.language ?? null)
      : knownText(guest.traits?.timeZone ?? null);
  const grouped = group(guests, read);
  if (grouped.known < 3) {
    return [];
  }
  const sorted = [...grouped.buckets].sort(
    (left, right) => right.count - left.count || left.value.localeCompare(right.value),
  );
  const top = sorted[0];
  const second = sorted[1];
  if (!top) {
    return [];
  }
  const strict = !second || top.count > second.count;
  const prefix = field === "language" ? "language" : "zone";
  const facts: FunFact[] = [];
  if (strict && sorted.length === 1) {
    const audience = audienceFor(grouped.unknown, guests.length);
    if (audience === "drop") {
      return [];
    }
    const sentence =
      field === "language"
        ? `All ${allOf(audience)} had ${languageName(top.value)} as a first language.`
        : `All ${allOf(audience)} were on ${zonePlace(top.value)} time.`;
    facts.push(
      make({
        id: `fun:${prefix}:all`,
        rank,
        numerator: top.count,
        denominator: grouped.known,
        unknownCount: grouped.unknown,
        percent: null,
        parts: [],
        memberIds: top.memberIds,
        sentence,
      }),
    );
    return facts;
  }
  const outsiders = strict
    ? sorted.filter((bucket) => bucket.value !== top.value)
    : sorted;
  const singletons = outsiders.filter((bucket) => bucket.count === 1);
  for (const bucket of outsiders) {
    if (bucket.count < 2) {
      continue;
    }
    const sentence =
      field === "language"
        ? `${bucket.count} of you had ${languageName(bucket.value)} as a first language.`
        : `${bucket.count} of you were on ${zonePlace(bucket.value)} time.`;
    facts.push(
      make({
        id: `fun:${prefix}:${slug(bucket.value)}`,
        rank,
        numerator: bucket.count,
        denominator: grouped.known,
        unknownCount: grouped.unknown,
        percent: null,
        parts: [],
        memberIds: bucket.memberIds,
        sentence,
      }),
    );
  }
  if (singletons.length > 0) {
    const memberIds = singletons.flatMap((bucket) => bucket.memberIds);
    const count = memberIds.length;
    const sentence =
      field === "language"
        ? `${people(count)} had a different first language.`
        : `${people(count)} ${count === 1 ? "was" : "were"} in another time zone.`;
    facts.push(
      make({
        id: `fun:${prefix}:other`,
        rank,
        numerator: count,
        denominator: grouped.known,
        unknownCount: grouped.unknown,
        percent: null,
        parts: [],
        memberIds,
        sentence,
      }),
    );
  }
  return facts;
}

function trollFacts(source: FunFactSource, guests: readonly FunFactGuest[]): FunFact[] {
  const guestIds = new Set(guests.map((guest) => guest.playerId));
  const trolls = source.trolls.filter((troll) => guestIds.has(troll.actorId));
  if (trolls.length === 0) {
    return [];
  }
  const facts: FunFact[] = [];
  const actors = [...new Set(trolls.map((troll) => troll.actorId))];
  facts.push(
    make({
      id: "fun:trolls",
      rank: 60,
      numerator: trolls.length,
      denominator: trolls.length,
      unknownCount: 0,
      percent: null,
      parts: [],
      memberIds: actors,
      sentence:
        trolls.length === 1
          ? "1 troll was played."
          : `${trolls.length} trolls were played.`,
    }),
  );
  const byLabel = new Map<string, string[]>();
  for (const troll of trolls) {
    byLabel.set(troll.label, [...(byLabel.get(troll.label) ?? []), troll.actorId]);
  }
  const ranked = [...byLabel.entries()].sort(
    (left, right) =>
      right[1].length - left[1].length || left[0].localeCompare(right[0]),
  );
  const lead = ranked[0];
  const next = ranked[1];
  if (lead && lead[1].length >= 2 && (!next || lead[1].length > next[1].length)) {
    facts.push(
      make({
        id: `fun:troll:${slug(lead[0])}`,
        rank: 61,
        numerator: lead[1].length,
        denominator: trolls.length,
        unknownCount: 0,
        percent: null,
        parts: [],
        memberIds: [...new Set(lead[1])],
        sentence: `The favourite troll was ${lead[0]}, sent ${lead[1].length} ${lead[1].length === 1 ? "time" : "times"}.`,
      }),
    );
  }
  return facts;
}

function likeFacts(source: FunFactSource, guests: readonly FunFactGuest[]): FunFact[] {
  const byId = new Map(guests.map((guest) => [guest.playerId, guest]));
  const counts = new Map<string, number>();
  for (const like of source.likes) {
    if (!byId.has(like.voterId) || !byId.has(like.targetId)) {
      continue;
    }
    counts.set(like.targetId, (counts.get(like.targetId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const lead = ranked[0];
  const next = ranked[1];
  if (!lead || lead[1] < 2 || (next && lead[1] <= next[1])) {
    return [];
  }
  const guest = byId.get(lead[0]);
  if (!guest) {
    return [];
  }
  const sentence = `${guest.nickname}'s nickname got ${lead[1]} likes.`;
  return [
    make({
      id: "fun:like",
      rank: 70,
      numerator: lead[1],
      denominator: [...counts.values()].reduce((sum, count) => sum + count, 0),
      unknownCount: 0,
      percent: null,
      parts: digitsIn(guest.nickname).map((count) => ({ label: "nickname", count })),
      memberIds: [guest.playerId],
      sentence,
    }),
  ];
}

function driverFacts(guests: readonly FunFactGuest[]): FunFact[] {
  const chosen = guests.filter((guest) => guest.driverStyle);
  if (chosen.length < 3) {
    return [];
  }
  const everyone = chosen.length === guests.length;
  return traitFacts({
    id: "driver",
    rankRare: 80,
    rankCommon: 80,
    guests: chosen,
    read: (guest) => guest.driverStyle,
    sentence: (value, shape, audience, count, percent) => {
      const name = driverStyles.find((style) => style.id === value)?.name ?? value;
      const crowd = everyone ? of(audience) : "of the drivers";
      const whole = everyone ? allOf(audience) : "of the drivers";
      if (shape === "rare") {
        return `${people(count)} chose the ${name} driver.`;
      }
      if (shape === "all") {
        return `All ${whole} chose the ${name} driver.`;
      }
      return `${percent}% ${crowd} chose the ${name} driver.`;
    },
  });
}

function mediaFacts(source: FunFactSource, guests: readonly FunFactGuest[]): FunFact[] {
  const guestIds = new Set(guests.map((guest) => guest.playerId));
  const facts: FunFact[] = [];
  for (const kind of ["photo", "voice"] as const) {
    const rows = source.media.filter(
      (item) => item.kind === kind && guestIds.has(item.playerId),
    );
    if (rows.length === 0) {
      continue;
    }
    const noun =
      kind === "photo"
        ? rows.length === 1
          ? "photo"
          : "photos"
        : rows.length === 1
          ? "voice clip"
          : "voice clips";
    facts.push(
      make({
        id: `fun:media:${kind}`,
        rank: kind === "photo" ? 90 : 91,
        numerator: rows.length,
        denominator: rows.length,
        unknownCount: 0,
        percent: null,
        parts: [],
        memberIds: [...new Set(rows.map((row) => row.playerId))],
        sentence: `${rows.length} ${noun} made it in.`,
      }),
    );
  }
  return facts;
}

function scoreFact(
  source: FunFactSource,
  guests: readonly FunFactGuest[],
): FunFact | null {
  const guestIds = new Set(guests.map((guest) => guest.playerId));
  const ranked = source.standings
    .filter((row) => guestIds.has(row.playerId))
    .sort(
      (left, right) =>
        right.points - left.points || left.playerId.localeCompare(right.playerId),
    );
  const first = ranked[0];
  const second = ranked[1];
  if (!first || !second) {
    return null;
  }
  const gap = Math.abs(first.points - second.points);
  return make({
    id: "fun:score-gap",
    rank: 100,
    numerator: gap,
    denominator: 2,
    unknownCount: 0,
    percent: null,
    parts: [],
    memberIds: [first.playerId, second.playerId],
    sentence:
      gap === 0
        ? "The top two finished level."
        : `The top two were ${gap} ${gap === 1 ? "point" : "points"} apart.`,
  });
}

function cap(facts: FunFact[]): FunFact[] {
  const score = facts.find((fact) => fact.id === "fun:score-gap");
  const rest = facts
    .filter((fact) => fact.id !== "fun:score-gap")
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
  const room = score ? funFactCap - 1 : funFactCap;
  const chosen = rest.slice(0, room);
  if (score) {
    chosen.push(score);
  }
  return chosen;
}

function group(
  guests: readonly FunFactGuest[],
  read: (guest: FunFactGuest) => string | null,
): { known: number; unknown: number; buckets: Bucket[] } {
  const buckets = new Map<string, string[]>();
  let unknown = 0;
  for (const guest of guests) {
    const value = read(guest);
    if (!value) {
      unknown += 1;
      continue;
    }
    buckets.set(value, [...(buckets.get(value) ?? []), guest.playerId]);
  }
  return {
    known: guests.length - unknown,
    unknown,
    buckets: [...buckets.entries()]
      .map(([value, memberIds]) => ({
        value,
        count: memberIds.length,
        memberIds: [...memberIds].sort(),
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.value.localeCompare(right.value),
      ),
  };
}

function shapesFor(buckets: readonly Bucket[], known: number): Map<string, Shape> {
  const shapes = new Map<string, Shape>();
  if (known < 3 || buckets.length === 0) {
    return shapes;
  }
  const top = buckets[0];
  const second = buckets[1];
  if (!top) {
    return shapes;
  }
  if (!second) {
    shapes.set(top.value, "all");
    return shapes;
  }
  for (const bucket of buckets) {
    if (bucket.count === 1 || bucket.count === 2) {
      shapes.set(bucket.value, "rare");
    }
  }
  if (top.count > second.count && known >= 5 && top.count > 2) {
    shapes.set(top.value, "percent");
  }
  return shapes;
}

function audienceFor(unknown: number, guests: number): Audience | "drop" {
  if (guests <= 0) {
    return "drop";
  }
  if (unknown * 5 < guests) {
    return "you";
  }
  if (unknown * 2 < guests) {
    return "phones";
  }
  return "drop";
}

function make(fact: FunFact): FunFact {
  return { ...fact, id: fact.id.slice(0, 80), memberIds: [...fact.memberIds].sort() };
}

function share(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((100 * numerator) / denominator);
}

function people(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

function of(audience: Audience): string {
  return audience === "you" ? "of you" : "of the phones we could read";
}

function allOf(audience: Audience): string {
  return audience === "you" ? "of you" : "of the phones we could read";
}

function knownText(value: string | null): string | null {
  if (!value || value === "unknown") {
    return null;
  }
  return value;
}

function slug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "value";
}

function digitsIn(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function nicknameDigits(
  sentence: string,
  count: number,
  percent: number,
): { label: string; count: number }[] {
  const spoken = new Set([count, percent]);
  return digitsIn(sentence)
    .filter((value) => !spoken.has(value))
    .map((value) => ({ label: "wording", count: value }));
}

function colorSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  const mode = value === "light" ? "light mode" : "dark mode";
  if (shape === "rare") {
    return `${people(count)} used ${mode}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} use ${mode}.`;
  }
  return `${percent}% ${of(audience)} use ${mode}.`;
}

function browserSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  const name = browserName(value);
  if (shape === "rare") {
    return `${people(count)} used ${name}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} use ${name}.`;
  }
  return `${percent}% ${of(audience)} use ${name}.`;
}

function osSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  if (shape === "rare") {
    return `${people(count)} ${count === 1 ? "was" : "were"} on ${value}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} were on ${value}.`;
  }
  return `${percent}% ${of(audience)} were on ${value}.`;
}

function motionSentence(
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  if (shape === "rare") {
    return `${people(count)} asked for reduced motion.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} asked for reduced motion.`;
  }
  return `${percent}% ${of(audience)} asked for reduced motion.`;
}

function orientationSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  if (shape === "rare") {
    return `${people(count)} held the phone in ${value}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} held the phone in ${value}.`;
  }
  return `${percent}% ${of(audience)} held the phone in ${value}.`;
}

function pointerSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  const action = value === "fine" ? "using a mouse or trackpad" : "tapping the screen";
  if (shape === "rare") {
    return `${people(count)} ${count === 1 ? "was" : "were"} ${action}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} were ${action}.`;
  }
  return `${percent}% ${of(audience)} were ${action}.`;
}

function saveDataSentence(
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  if (shape === "rare") {
    return `${people(count)} had data saver on.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} had data saver on.`;
  }
  return `${percent}% ${of(audience)} had data saver on.`;
}

function screenSentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  if (shape === "rare") {
    return `${people(count)} had a ${value} screen.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} had a ${value} screen.`;
  }
  return `${percent}% ${of(audience)} had a ${value} screen.`;
}

function familySentence(
  value: string,
  shape: Shape,
  audience: Audience,
  count: number,
  percent: number,
): string {
  const noun = familyNoun(value, shape === "percent" ? 2 : 1);
  if (shape === "rare") {
    return `${people(count)} joined on ${noun}.`;
  }
  if (shape === "all") {
    return `All ${allOf(audience)} joined on ${noun}.`;
  }
  return `${percent}% ${of(audience)} joined on ${noun}.`;
}

function familyNoun(value: string, count: number): string {
  const nouns: Record<string, [string, string]> = {
    iphone: ["an iPhone", "iPhones"],
    ipad: ["an iPad", "iPads"],
    android: ["an Android phone", "Android phones"],
    desktop: ["a desktop", "desktops"],
    other: ["another kind of device", "other devices"],
  };
  const pair = nouns[value] ?? [value, value];
  return count === 1 ? pair[0] : pair[1];
}

function browserName(value: string): string {
  const names: Record<string, string> = {
    firefox: "Firefox",
    chrome: "Chrome",
    safari: "Safari",
    edge: "Edge",
    opera: "Opera",
    other: "another browser",
  };
  return names[value] ?? value;
}

function languageName(tag: string): string {
  const names: Record<string, string> = {
    en: "English",
    "en-gb": "British English",
    "en-us": "American English",
    ur: "Urdu",
    fr: "French",
    de: "German",
    es: "Spanish",
    ar: "Arabic",
    hi: "Hindi",
    pa: "Punjabi",
    pl: "Polish",
    pt: "Portuguese",
    it: "Italian",
    tr: "Turkish",
    zh: "Chinese",
  };
  const key = tag.toLowerCase();
  return names[key] ?? names[key.split("-")[0] ?? ""] ?? tag;
}

function zonePlace(zone: string): string {
  const city = zone.split("/").pop() ?? zone;
  return city.replaceAll("_", " ");
}
