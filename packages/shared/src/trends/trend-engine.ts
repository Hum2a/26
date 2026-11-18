import {
  trendMinimumGroup,
  trendStageCap,
  type TrendCard,
  type TrendIcon,
  type TrendLine,
  type TrendTone,
} from "./trend-schema.ts";

/**
 * Pure answer-trend analysis for one question. The room reads its stored
 * answers, device reports and scores into a `TrendInput`; this module turns
 * them into ranked cards for the projector and a few lines for each phone.
 * No clock, no randomness, no I/O: the same input always gives the same cards.
 */

export type TrendDevice = {
  family: "iphone" | "ipad" | "android" | "desktop" | "other" | "unknown";
  os: string;
  osMajor: number | null;
  browser: string;
  colorScheme: "light" | "dark" | "unknown";
  reducedMotion: "reduce" | "no-preference" | "unknown";
  language: string | null;
  timeZone: string | null;
  shortEdge: number | null;
  pixelRatio: number | null;
  orientation: "portrait" | "landscape" | "unknown";
  memoryGb: number | null;
  quality: string;
  saveData: boolean | null;
};

export type TrendPlayer = {
  playerId: string;
  nickname: string;
  /** 0 for the first guest to join. */
  joinOrder: number;
  device: TrendDevice | null;
  reconnects: number;
  rttMs: number | null;
  /** Points before this question. */
  scoreBefore: number;
  trollsSent: number;
  trollsReceived: number;
  sharedPhoto: boolean;
  hasAvatar: boolean;
  /** The previous scored question: right, wrong, or not answered. */
  previousCorrect: boolean | null;
};

export type TrendResponse = {
  playerId: string;
  /** Option ids, a normalised typed answer, a ballot or an outcome bucket. */
  picks: string[];
  value: number | null;
  correct: boolean | null;
  points: number | null;
  /** From answering opening to the room's receipt. */
  elapsedMs: number | null;
  windowMs: number | null;
  /** The device the answer was sent from; falls back to the player's. */
  device: TrendDevice | null;
};

export type TrendNumeric = {
  /** "guess", "finish time", "guesses", "points", "captures". */
  noun: string;
  /** "£", "p", "p/litre", "/100", "s", "guesses", "pts". */
  unit: string;
  /** How a better value looks: lower times, higher points, closer guesses. */
  better: "lower" | "higher" | "closer" | null;
  truth: number | null;
  /** Price-is-right rounds: going over the truth scores nothing. */
  overIsBust?: boolean;
};

export type TrendQuestion = {
  questionId: string;
  kind: string;
  prompt: string;
  /** Labels for every pick key. Unknown keys are not quoted. */
  options: { id: string; label: string }[];
  /** "picked", "voted for", "opened with", "ranked first". */
  pickVerb: string;
  numeric: TrendNumeric | null;
  /** Someone could be right or wrong. */
  scored: boolean;
  /** "got it right", "solved it", "beat the bot", "finished". */
  success: string;
  /** Response times are worth comparing (not kart or chess). */
  timed: boolean;
};

export type TrendInput = {
  question: TrendQuestion;
  players: readonly TrendPlayer[];
  responses: readonly TrendResponse[];
  /** Earlier scored questions in this game, oldest first. */
  history: readonly { questionId: string; accuracy: number }[];
};

export type RankedTrendCard = TrendCard & {
  /** 0 to 100: how surprising and well supported the card is. */
  score: number;
  /** Players the card is about, for "that's you" on phones. Never sent. */
  members: readonly string[];
};

export type TrendAnalysis = {
  questionId: string;
  responses: number;
  /** Responses with a known device. */
  classified: number;
  cards: RankedTrendCard[];
  /** Internal, for phone lines. */
  rows: readonly Row[];
  question: TrendQuestion;
};

type Row = {
  player: TrendPlayer;
  response: TrendResponse;
  device: TrendDevice | null;
  /** 0 is the fastest response, 1 the slowest; null when untimed. */
  speed: number | null;
  /** Distance from the truth, when the question has one. */
  error: number | null;
};

type Facet = {
  id: string;
  icon: TrendIcon;
  tone: "device" | "behaviour";
  weight: number;
  /** `rest`: each group against everyone else known. `pair`: the two groups only. */
  compare: "rest" | "pair";
  key: (row: Row, context: FacetContext) => string | null;
  name: (key: string) => string;
};

type FacetContext = {
  newestIos: number | null;
  scoreCut: { top: number; bottom: number } | null;
  joinCut: { early: number; late: number } | null;
};

const facets: readonly Facet[] = [
  {
    id: "platform",
    icon: "apple",
    tone: "device",
    weight: 1.25,
    compare: "rest",
    key: ({ device }) =>
      device && ["iphone", "android", "desktop", "ipad"].includes(device.family)
        ? device.family
        : null,
    name: (key) =>
      ({
        iphone: "iPhone users",
        android: "Android users",
        desktop: "laptop players",
        ipad: "iPad players",
      })[key] ?? "other devices",
  },
  {
    id: "browser",
    icon: "compass",
    tone: "device",
    weight: 1,
    compare: "rest",
    key: ({ device }) =>
      device &&
      ["safari", "chrome", "firefox", "edge", "opera"].includes(device.browser)
        ? device.browser
        : null,
    name: (key) =>
      ({
        safari: "Safari users",
        chrome: "Chrome users",
        firefox: "Firefox users",
        edge: "Edge users",
        opera: "Opera users",
      })[key] ?? "other browsers",
  },
  {
    id: "theme",
    icon: "moon",
    tone: "device",
    weight: 1.05,
    compare: "rest",
    key: ({ device }) =>
      device && device.colorScheme !== "unknown" ? device.colorScheme : null,
    name: (key) => (key === "dark" ? "dark-mode people" : "light-mode people"),
  },
  {
    id: "software",
    icon: "sparkles",
    tone: "device",
    weight: 0.8,
    compare: "pair",
    key: ({ device }, context) => {
      if (!device || device.family !== "iphone" || device.osMajor === null) return null;
      if (context.newestIos === null) return null;
      return device.osMajor >= context.newestIos ? "newest" : "older";
    },
    name: (key) =>
      key === "newest" ? "iPhones on the newest iOS" : "iPhones overdue an update",
  },
  {
    id: "screen",
    icon: "ruler",
    tone: "device",
    weight: 0.9,
    compare: "pair",
    key: ({ device }) => {
      if (!device || device.shortEdge === null) return null;
      if (device.family !== "iphone" && device.family !== "android") return null;
      return device.shortEdge >= 414 ? "big" : "compact";
    },
    name: (key) => (key === "big" ? "big-screen phones" : "compact phones"),
  },
  {
    id: "sharpness",
    icon: "sparkles",
    tone: "device",
    weight: 0.5,
    compare: "pair",
    key: ({ device }) =>
      !device || device.pixelRatio === null
        ? null
        : device.pixelRatio >= 3
          ? "sharp"
          : "soft",
    name: (key) => (key === "sharp" ? "ultra-sharp screens" : "softer screens"),
  },
  {
    id: "language",
    icon: "languages",
    tone: "device",
    weight: 0.9,
    compare: "rest",
    key: ({ device }) => {
      const language = device?.language?.toLowerCase();
      if (!language) return null;
      if (language === "en-gb") return "gb";
      if (language === "en-us") return "us";
      if (language.startsWith("en")) return "en";
      return "other";
    },
    name: (key) =>
      ({
        gb: "British-English phones",
        us: "phones set to American English",
        en: "other English phones",
        other: "phones in another language",
      })[key] ?? "other phones",
  },
  {
    id: "timezone",
    icon: "globe",
    tone: "device",
    weight: 0.8,
    compare: "pair",
    key: ({ device }) =>
      device?.timeZone
        ? device.timeZone === "Europe/London"
          ? "london"
          : "away"
        : null,
    name: (key) =>
      key === "london" ? "phones on London time" : "phones on another time zone",
  },
  {
    id: "connection",
    icon: "wifi",
    tone: "device",
    weight: 0.8,
    compare: "pair",
    key: ({ player, device }) => {
      if (player.rttMs !== null) return player.rttMs >= 150 ? "laggy" : "snappy";
      if (!device || device.quality === "unknown") return null;
      return device.quality === "4g" ? "snappy" : "laggy";
    },
    name: (key) => (key === "laggy" ? "laggy connections" : "snappy connections"),
  },
  {
    id: "dropouts",
    icon: "plug",
    tone: "device",
    weight: 0.8,
    compare: "pair",
    key: ({ player }) => (player.reconnects > 0 ? "dropped" : "solid"),
    name: (key) =>
      key === "dropped" ? "people whose phone dropped out" : "rock-solid connections",
  },
  {
    id: "memory",
    icon: "cpu",
    tone: "device",
    weight: 0.7,
    compare: "pair",
    key: ({ device }) =>
      !device || device.memoryGb === null
        ? null
        : device.memoryGb >= 8
          ? "beefy"
          : "light",
    name: (key) => (key === "beefy" ? "8GB-plus phones" : "lighter phones"),
  },
  {
    id: "motion",
    icon: "feather",
    tone: "device",
    weight: 0.6,
    compare: "pair",
    key: ({ device }) =>
      !device || device.reducedMotion === "unknown"
        ? null
        : device.reducedMotion === "reduce"
          ? "calm"
          : "moving",
    name: (key) => (key === "calm" ? "reduced-motion fans" : "full-motion phones"),
  },
  {
    id: "orientation",
    icon: "rotate",
    tone: "device",
    weight: 0.6,
    compare: "pair",
    key: ({ device }) =>
      !device || device.orientation === "unknown" ? null : device.orientation,
    name: (key) => (key === "landscape" ? "sideways phones" : "upright phones"),
  },
  {
    id: "saver",
    icon: "leaf",
    tone: "device",
    weight: 0.6,
    compare: "pair",
    key: ({ device }) =>
      !device || device.saveData === null ? null : device.saveData ? "saver" : "full",
    name: (key) => (key === "saver" ? "data savers" : "full-data phones"),
  },
  {
    id: "speed",
    icon: "zap",
    tone: "behaviour",
    weight: 1.05,
    compare: "pair",
    key: ({ speed }) =>
      speed === null ? null : speed <= 0.25 ? "fast" : speed >= 0.75 ? "slow" : null,
    name: (key) => (key === "fast" ? "the fastest quarter" : "the slowest quarter"),
  },
  {
    id: "buzzer",
    icon: "alarm",
    tone: "behaviour",
    weight: 0.9,
    compare: "pair",
    key: ({ response }) => {
      if (response.elapsedMs === null || response.windowMs === null) return null;
      return response.windowMs - response.elapsedMs <= 3_000 ? "late" : "calm";
    },
    name: (key) => (key === "late" ? "last-second answers" : "everyone else"),
  },
  {
    id: "standing",
    icon: "crown",
    tone: "behaviour",
    weight: 1.05,
    compare: "pair",
    key: ({ player }, context) => {
      if (!context.scoreCut) return null;
      if (player.scoreBefore >= context.scoreCut.top) return "top";
      if (player.scoreBefore <= context.scoreCut.bottom) return "bottom";
      return null;
    },
    name: (key) => (key === "top" ? "the leaders" : "the chasing pack"),
  },
  {
    id: "arrival",
    icon: "footprints",
    tone: "behaviour",
    weight: 0.8,
    compare: "pair",
    key: ({ player }, context) => {
      if (!context.joinCut) return null;
      if (player.joinOrder <= context.joinCut.early) return "early";
      if (player.joinOrder >= context.joinCut.late) return "late";
      return null;
    },
    name: (key) => (key === "early" ? "the early arrivals" : "the latecomers"),
  },
  {
    id: "trolls",
    icon: "skull",
    tone: "behaviour",
    weight: 1,
    compare: "pair",
    key: ({ player }) => (player.trollsSent > 0 ? "troll" : "innocent"),
    name: (key) => (key === "troll" ? "the trolls" : "the innocent"),
  },
  {
    id: "victims",
    icon: "shield",
    tone: "behaviour",
    weight: 0.9,
    compare: "pair",
    key: ({ player }) => (player.trollsReceived > 0 ? "victim" : "spared"),
    name: (key) => (key === "victim" ? "troll victims" : "the untrolled"),
  },
  {
    id: "photos",
    icon: "camera",
    tone: "behaviour",
    weight: 0.7,
    compare: "pair",
    key: ({ player }) => (player.sharedPhoto ? "sharer" : "lurker"),
    name: (key) => (key === "sharer" ? "photo-sharers" : "camera-shy guests"),
  },
  {
    id: "selfie",
    icon: "smile",
    tone: "behaviour",
    weight: 0.7,
    compare: "pair",
    key: ({ player }) => (player.hasAvatar ? "face" : "faceless"),
    name: (key) =>
      key === "face" ? "people with a profile photo" : "people without a photo",
  },
  {
    id: "streak",
    icon: "flame",
    tone: "behaviour",
    weight: 0.9,
    compare: "pair",
    key: ({ player }) =>
      player.previousCorrect === null ? null : player.previousCorrect ? "hot" : "cold",
    name: (key) =>
      key === "hot" ? "last question's winners" : "last question's strugglers",
  },
  {
    id: "names",
    icon: "type",
    tone: "behaviour",
    weight: 0.6,
    compare: "pair",
    key: ({ player }) => {
      const length = [...player.nickname.trim()].length;
      return length <= 4 ? "short" : length >= 9 ? "long" : null;
    },
    name: (key) =>
      key === "short" ? "short names (four letters or fewer)" : "long names",
  },
];

/** Analyse one question. Rows without a guest player are ignored. */
export function analyseTrends(input: TrendInput): TrendAnalysis {
  const players = new Map(input.players.map((player) => [player.playerId, player]));
  const latest = new Map<string, TrendResponse>();
  for (const response of input.responses) {
    if (players.has(response.playerId)) latest.set(response.playerId, response);
  }
  const responses = [...latest.values()];
  const timed = input.question.timed
    ? responses
        .filter((response) => response.elapsedMs !== null)
        .sort(
          (left, right) =>
            (left.elapsedMs ?? 0) - (right.elapsedMs ?? 0) ||
            left.playerId.localeCompare(right.playerId),
        )
    : [];
  const speedOf = new Map<string, number>();
  timed.forEach((response, index) => {
    speedOf.set(response.playerId, timed.length <= 1 ? 0 : index / (timed.length - 1));
  });
  const truth = numericTruth(input.question, responses);
  const rows: Row[] = responses.map((response) => {
    const player = players.get(response.playerId)!;
    return {
      player,
      response,
      device: response.device ?? player.device,
      speed: speedOf.get(response.playerId) ?? null,
      error:
        truth !== null && response.value !== null
          ? Math.abs(response.value - truth)
          : null,
    };
  });
  const context = facetContext(input.players, rows);
  const cards: RankedTrendCard[] = [
    ...answerCards(input, rows, truth),
    ...recordCards(input.question, rows, truth),
    ...facets.flatMap((facet) =>
      facetCards(input.question, rows, facet, context, truth),
    ),
  ];
  const seen = new Set<string>();
  const unique = cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  unique.sort(
    (left, right) => right.score - left.score || left.id.localeCompare(right.id),
  );
  return {
    questionId: input.question.questionId,
    responses: rows.length,
    classified: rows.filter((row) => row.device && row.device.family !== "unknown")
      .length,
    cards: unique.slice(0, 40),
    rows,
    question: input.question,
  };
}

/**
 * The projector's cards: an overview first, then the strongest comparisons,
 * one per facet, mixing devices and behaviour. Hidden cards never appear.
 */
export function pickStageCards(
  analysis: TrendAnalysis,
  hidden: ReadonlySet<string> = new Set(),
  cap: number = trendStageCap,
): RankedTrendCard[] {
  const available = analysis.cards.filter((card) => !hidden.has(card.id));
  const chosen: RankedTrendCard[] = [];
  const facetsUsed = new Set<string>();
  const take = (card: RankedTrendCard | undefined) => {
    if (!card || chosen.length >= cap || facetsUsed.has(card.facet)) return;
    chosen.push(card);
    facetsUsed.add(card.facet);
  };
  take(available.find((card) => card.tone === "answer"));
  take(available.find((card) => card.tone === "device"));
  take(available.find((card) => card.tone === "behaviour"));
  for (const card of available) {
    if (chosen.length >= cap) break;
    const devices = chosen.filter((item) => item.tone === "device").length;
    if (card.tone === "device" && devices >= Math.ceil(cap / 2)) continue;
    take(card);
  }
  return chosen.sort((left, right) => toneOrder(left.tone) - toneOrder(right.tone));
}

/** Strip the analysis-only fields before a card leaves the room. */
export function publicTrendCard(card: RankedTrendCard): TrendCard {
  return {
    id: card.id,
    facet: card.facet,
    tone: card.tone,
    icon: card.icon,
    headline: card.headline,
    detail: card.detail,
    figure: card.figure,
    bars: card.bars,
  };
}

/** Up to four lines for one guest's phone. Null when they did not answer. */
export function selfTrendLines(
  analysis: TrendAnalysis,
  playerId: string,
  stageCards: readonly RankedTrendCard[] = [],
): TrendLine[] | null {
  const row = analysis.rows.find((item) => item.player.playerId === playerId);
  if (!row) return null;
  const { question } = analysis;
  const others = analysis.rows.filter((item) => item !== row);
  const lines: TrendLine[] = [];
  const pick = row.response.picks[0];
  if (question.scored && row.response.correct !== null && others.length > 0) {
    const same = others.filter(
      (item) => item.response.correct === row.response.correct,
    );
    const share = percent(same.length + 1, analysis.rows.length);
    lines.push({
      icon: row.response.correct ? "trophy" : "users",
      text: row.response.correct
        ? `You were one of the ${share}% who ${question.success}.`
        : `You were with the ${share}% who didn’t. Strength in numbers.`,
    });
  } else if (pick && others.length > 0 && question.options.length > 0) {
    const label = labelOf(question, pick);
    const same = others.filter((item) => item.response.picks.includes(pick)).length;
    if (label) {
      lines.push(
        same === 0
          ? {
              icon: "feather",
              text: `Lone wolf: nobody else ${question.pickVerb} ${clip(label, 60)}.`,
            }
          : {
              icon: "users",
              text: `${percent(same, others.length)}% of the room ${question.pickVerb} ${clip(label, 60)} too.`,
            },
      );
    }
  }
  const tribe = facets[0]!;
  const tribeKey = row.device ? tribe.key(row, emptyContext) : null;
  if (tribeKey) {
    const mates = others.filter((item) => tribe.key(item, emptyContext) === tribeKey);
    if (mates.length >= 2) {
      const name = tribe.name(tribeKey);
      if (question.scored && row.response.correct !== null) {
        const right = mates.filter((item) => item.response.correct).length;
        lines.push({
          icon: tribeKey === "android" ? "android" : "apple",
          text: `${percent(right, mates.length)}% of your fellow ${name} ${question.success}.`,
        });
      } else if (pick) {
        const agree = mates.filter((item) => item.response.picks.includes(pick)).length;
        lines.push({
          icon: tribeKey === "android" ? "android" : "apple",
          text: `${percent(agree, mates.length)}% of your fellow ${name} agreed with you.`,
        });
      }
    }
  }
  if (row.error !== null && question.numeric && question.numeric.better === "closer") {
    const errors = others.filter((item) => item.error !== null);
    if (errors.length > 0) {
      const beaten = errors.filter(
        (item) => (item.error ?? 0) > (row.error ?? 0),
      ).length;
      lines.push({
        icon: "target",
        text:
          beaten === errors.length
            ? "Closest in the room. Frighteningly good."
            : `Closer than ${percent(beaten, errors.length)}% of the room.`,
      });
    }
  } else if (row.response.value !== null && question.numeric?.better) {
    const values = others.filter((item) => item.response.value !== null);
    if (values.length > 0) {
      const lower = question.numeric.better === "lower";
      const beaten = values.filter((item) =>
        lower
          ? (item.response.value ?? 0) > (row.response.value ?? 0)
          : (item.response.value ?? 0) < (row.response.value ?? 0),
      ).length;
      lines.push({
        icon: lower ? "zap" : "chart",
        text: `Better than ${percent(beaten, values.length)}% of the room on ${question.numeric.noun}.`,
      });
    }
  }
  if (
    row.speed !== null &&
    analysis.rows.filter((item) => item.speed !== null).length > 2
  ) {
    const faster = Math.round((1 - row.speed) * 100);
    lines.push({
      icon: faster >= 50 ? "zap" : "hourglass",
      text:
        faster >= 99
          ? "The fastest answer in the room."
          : faster >= 50
            ? `Faster than ${faster}% of the room.`
            : `You took your time: ${100 - faster}% answered quicker.`,
    });
  }
  const spotlight = stageCards.find(
    (card) => card.tone !== "answer" && card.members.includes(playerId),
  );
  if (spotlight) {
    lines.push({
      icon: "sparkles",
      text: `On the big screen: “${clip(spotlight.headline, 100)}” That’s you.`,
    });
  }
  return lines.length > 0 ? lines.slice(0, 4) : null;
}

const emptyContext: FacetContext = { newestIos: null, scoreCut: null, joinCut: null };

function toneOrder(tone: TrendTone): number {
  return tone === "answer" ? 0 : tone === "record" ? 1 : 2;
}

function facetContext(
  players: readonly TrendPlayer[],
  rows: readonly Row[],
): FacetContext {
  const ios = rows
    .map((row) => (row.device?.family === "iphone" ? row.device.osMajor : null))
    .filter((value): value is number => value !== null);
  const distinctIos = new Set(ios);
  const scores = players.map((player) => player.scoreBefore).sort((a, b) => a - b);
  const someScored = scores.some((score) => score > 0);
  const third = (sorted: number[], fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
  const order = players.map((player) => player.joinOrder).sort((a, b) => a - b);
  return {
    newestIos: distinctIos.size >= 2 ? Math.max(...ios) : null,
    scoreCut:
      someScored && scores.length >= trendMinimumGroup * 3
        ? { top: Math.max(1, third(scores, 2 / 3)), bottom: third(scores, 1 / 3) }
        : null,
    joinCut:
      order.length >= trendMinimumGroup * 3
        ? { early: third(order, 1 / 3) - 1, late: third(order, 2 / 3) + 1 }
        : null,
  };
}

function numericTruth(question: TrendQuestion, responses: readonly TrendResponse[]) {
  if (!question.numeric || question.numeric.better !== "closer") return null;
  if (question.numeric.truth !== null) return question.numeric.truth;
  const values = responses
    .map((response) => response.value)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? median(values) : null;
}

function answerCards(
  input: TrendInput,
  rows: readonly Row[],
  truth: number | null,
): RankedTrendCard[] {
  const { question } = input;
  const cards: RankedTrendCard[] = [];
  const id = (suffix: string) => `${question.questionId}:answer:${suffix}`;
  const total = rows.length;
  if (total === 0) return cards;
  const picked = pickCounts(question, rows);
  const ranked = [...picked.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const top = ranked[0];
  const second = ranked[1];
  if (top && total >= 3 && labelOf(question, top[0])) {
    const share = top[1] / total;
    const label = labelOf(question, top[0])!;
    if (share >= 0.75) {
      cards.push(
        card(question, {
          id: id("consensus"),
          facet: "answer",
          tone: "answer",
          icon: "users",
          headline:
            share === 1
              ? `Unanimous: everyone ${question.pickVerb} ${clip(label, 50)}`
              : `Near-unanimous: ${percent(top[1], total)}% ${question.pickVerb} ${clip(label, 40)}`,
          detail: `${top[1]} of ${total} answers ${top[1] === 1 ? "was" : "were"} ${clip(label, 80)}. Hive mind confirmed.`,
          figure: { value: `${percent(top[1], total)}%`, caption: "went the same way" },
          bars: optionBars(question, ranked, total),
          score: 40 + share * 30,
          members: membersPicking(rows, top[0]),
        }),
      );
    } else if (
      second &&
      labelOf(question, second[0]) &&
      share - second[1] / total <= 0.1 &&
      second[1] / total >= 0.25
    ) {
      const other = labelOf(question, second[0])!;
      cards.push(
        card(question, {
          id: id("split"),
          facet: "answer",
          tone: "answer",
          icon: "split",
          headline: `Split down the middle: ${clip(label, 36)} vs ${clip(other, 36)}`,
          detail: `${percent(top[1], total)}% against ${percent(second[1], total)}%. This room cannot agree on anything.`,
          figure: { value: `${Math.abs(top[1] - second[1])}`, caption: "votes in it" },
          bars: optionBars(question, ranked, total),
          score: 55,
          members: [],
        }),
      );
    } else {
      cards.push(
        card(question, {
          id: id("favourite"),
          facet: "answer",
          tone: "answer",
          icon: "chart",
          headline: `Room favourite: ${clip(label, 70)}`,
          detail: `${percent(top[1], total)}% ${question.pickVerb} it. ${ranked.length} different answers in all.`,
          figure: { value: `${percent(top[1], total)}%`, caption: "of the room" },
          bars: optionBars(question, ranked, total),
          score: 30,
          members: membersPicking(rows, top[0]),
        }),
      );
    }
  }
  if (total >= 5) {
    const lonely = ranked.find(([key, count]) => count === 1 && labelOf(question, key));
    if (lonely) {
      cards.push(
        card(question, {
          id: id(`lone:${lonely[0]}`),
          facet: "lone",
          tone: "answer",
          icon: "feather",
          headline: `One brave soul ${question.pickVerb} ${clip(labelOf(question, lonely[0])!, 60)}`,
          detail: "Just one person, out of everyone. You know who you are.",
          figure: { value: "1", caption: `of ${total}` },
          bars: [],
          score: 35,
          members: [],
        }),
      );
    }
    if (question.kind === "choice" || question.kind === "multiple") {
      const ghost = question.options.find((option) => !picked.has(option.id));
      if (ghost && total >= 6) {
        cards.push(
          card(question, {
            id: id(`ghost:${ghost.id}`),
            facet: "ghost",
            tone: "answer",
            icon: "ghost",
            headline: `Nobody ${question.pickVerb} ${clip(ghost.label, 70)}`,
            detail: `Not one of ${total} answers. A ghost option.`,
            figure: { value: "0", caption: `of ${total}` },
            bars: [],
            score: 33,
            members: [],
          }),
        );
      }
    }
  }
  const judged = rows.filter((row) => row.response.correct !== null);
  if (question.scored && judged.length >= 3) {
    const right = judged.filter((row) => row.response.correct).length;
    const accuracy = right / judged.length;
    const earlier = input.history.filter(
      (item) => item.questionId !== question.questionId,
    );
    const hardest =
      earlier.length >= 2 &&
      accuracy < Math.min(...earlier.map((item) => item.accuracy));
    const easiest =
      earlier.length >= 2 &&
      accuracy > Math.max(...earlier.map((item) => item.accuracy));
    cards.push(
      card(question, {
        id: id("accuracy"),
        facet: "accuracy",
        tone: "answer",
        icon: hardest ? "skull" : easiest ? "trophy" : "target",
        headline: hardest
          ? "The hardest question so far"
          : easiest
            ? "The easiest question so far"
            : right === 0
              ? `Nobody ${question.success}`
              : right === judged.length
                ? `Everyone ${question.success}`
                : `${percent(right, judged.length)}% ${question.success}`,
        detail: `${right} of ${judged.length} ${question.success}.${
          hardest
            ? " A new low for the room."
            : easiest
              ? " Too easy? Noted."
              : earlier.length > 0
                ? ` The game average is ${percent(
                    earlier.reduce((sum, item) => sum + item.accuracy, 0),
                    earlier.length,
                  )}%.`
                : ""
        }`,
        figure: {
          value: `${percent(right, judged.length)}%`,
          caption: question.success,
        },
        bars: [],
        score:
          hardest || easiest ? 58 : right === 0 || right === judged.length ? 50 : 26,
        members: [],
      }),
    );
  }
  if (question.numeric && truth !== null) {
    cards.push(...numericAnswerCards(question, rows, truth));
  } else if (question.numeric) {
    const values = rows
      .map((row) => row.response.value)
      .filter((value): value is number => value !== null);
    if (values.length >= 3) {
      cards.push(
        card(question, {
          id: id("average"),
          facet: "average",
          tone: "answer",
          icon: "chart",
          headline: `Average ${question.numeric.noun}: ${formatValue(mean(values), question.numeric.unit)}`,
          detail: `From ${formatValue(Math.min(...values), question.numeric.unit)} to ${formatValue(Math.max(...values), question.numeric.unit)} across ${values.length} players.`,
          figure: {
            value: formatValue(mean(values), question.numeric.unit),
            caption: "on average",
          },
          bars: [],
          score: 24,
          members: [],
        }),
      );
    }
  }
  if (question.kind === "typed" && total >= 4) {
    const distinct = picked.size;
    if (distinct >= Math.max(4, Math.ceil(total / 2))) {
      cards.push(
        card(question, {
          id: id("variety"),
          facet: "variety",
          tone: "answer",
          icon: "type",
          headline: `${distinct} different answers from ${total} people`,
          detail: "Creative, or just unable to spell? The room will never know.",
          figure: { value: `${distinct}`, caption: "different answers" },
          bars: [],
          score: 38,
          members: [],
        }),
      );
    }
  }
  if (question.timed) {
    const times = rows
      .map((row) => row.response.elapsedMs)
      .filter((value): value is number => value !== null);
    if (times.length >= 3) {
      const average = mean(times) / 1000;
      cards.push(
        card(question, {
          id: id("pace"),
          facet: "pace",
          tone: "answer",
          icon: "hourglass",
          headline: `Average answer time: ${average.toFixed(1)}s`,
          detail:
            average < 5
              ? "Quick-fire. Barely read the question, some of you."
              : average > 12
                ? "A long think. The clock was sweating."
                : "Steady. Not rushed, not dawdling.",
          figure: { value: `${average.toFixed(1)}s`, caption: "average answer" },
          bars: [],
          score: 18,
          members: [],
        }),
      );
    }
  }
  return cards;
}

function numericAnswerCards(
  question: TrendQuestion,
  rows: readonly Row[],
  truth: number,
): RankedTrendCard[] {
  const numeric = question.numeric!;
  const values = rows
    .map((row) => row.response.value)
    .filter((value): value is number => value !== null);
  if (values.length < 3) return [];
  const id = (suffix: string) => `${question.questionId}:answer:${suffix}`;
  const cards: RankedTrendCard[] = [];
  const middle = median(values);
  const consensus = numeric.truth === null;
  if (consensus) {
    cards.push(
      card(question, {
        id: id("middle"),
        facet: "crowd",
        tone: "answer",
        icon: "users",
        headline: `The room landed on ${formatValue(middle, numeric.unit)}`,
        detail: `Guesses ran from ${formatValue(Math.min(...values), numeric.unit)} to ${formatValue(Math.max(...values), numeric.unit)}.`,
        figure: {
          value: formatValue(middle, numeric.unit),
          caption: "middle of the room",
        },
        bars: [],
        score: 40,
        members: [],
      }),
    );
    return cards;
  }
  const average = mean(values);
  const bias = truth === 0 ? 0 : (average - truth) / Math.abs(truth);
  if (Math.abs(bias) >= 0.05) {
    cards.push(
      card(question, {
        id: id("bias"),
        facet: "bias",
        tone: "answer",
        icon: bias > 0 ? "flame" : "leaf",
        headline: `The room guessed ${percent(Math.abs(bias), 1)}% too ${bias > 0 ? "high" : "low"}`,
        detail: `Average guess ${formatValue(average, numeric.unit)}; the answer was ${formatValue(truth, numeric.unit)}. ${
          bias > 0 ? "Living in the future." : "Still living in 2010."
        }`,
        figure: {
          value: `${bias > 0 ? "+" : "−"}${percent(Math.abs(bias), 1)}%`,
          caption: "average miss",
        },
        bars: [],
        score: 42 + Math.min(20, Math.abs(bias) * 40),
        members: [],
      }),
    );
  }
  const crowdMiss =
    truth === 0 ? Math.abs(middle) : Math.abs(middle - truth) / Math.abs(truth);
  cards.push(
    card(question, {
      id: id("wisdom"),
      facet: "crowd",
      tone: "answer",
      icon: "brain",
      headline:
        crowdMiss <= 0.05
          ? "Wisdom of the crowd: the room's middle guess nailed it"
          : `The room's middle guess was ${percent(crowdMiss, 1)}% out`,
      detail: `Middle guess ${formatValue(middle, numeric.unit)} against ${formatValue(truth, numeric.unit)}.`,
      figure: { value: formatValue(middle, numeric.unit), caption: "middle guess" },
      bars: [],
      score: crowdMiss <= 0.05 ? 52 : 28,
      members: [],
    }),
  );
  if (numeric.overIsBust) {
    const over = values.filter((value) => value > truth).length;
    if (over > 0) {
      cards.push(
        card(question, {
          id: id("bust"),
          facet: "bust",
          tone: "answer",
          icon: "skull",
          headline: `${over} ${over === 1 ? "person" : "people"} went over and scored nothing`,
          detail: `${percent(over, values.length)}% overshot ${formatValue(truth, numeric.unit)}. Greed is a sin.`,
          figure: { value: `${over}`, caption: "went bust" },
          bars: [],
          score: 36 + percent(over, values.length) / 5,
          members: [],
        }),
      );
    }
  }
  return cards;
}

function recordCards(
  question: TrendQuestion,
  rows: readonly Row[],
  truth: number | null,
): RankedTrendCard[] {
  const cards: RankedTrendCard[] = [];
  const id = (suffix: string) => `${question.questionId}:record:${suffix}`;
  if (rows.length < 2) return cards;
  if (question.timed) {
    const eligible = rows.filter(
      (row) =>
        row.response.elapsedMs !== null &&
        (question.scored ? row.response.correct === true : true),
    );
    const fastest = uniqueBest(
      eligible,
      (row) => row.response.elapsedMs ?? 0,
      "lowest",
    );
    if (fastest) {
      const seconds = (fastest.response.elapsedMs ?? 0) / 1000;
      cards.push(
        card(question, {
          id: id("fastest"),
          facet: "fastest",
          tone: "record",
          icon: "zap",
          headline: `Fastest finger: ${fastest.player.nickname}`,
          detail: question.scored
            ? `Right answer in ${seconds.toFixed(1)}s.`
            : `Answered in ${seconds.toFixed(1)}s.`,
          figure: { value: `${seconds.toFixed(1)}s`, caption: "fastest answer" },
          bars: [],
          score: seconds < 3 ? 46 : 32,
          members: [fastest.player.playerId],
        }),
      );
    }
  }
  if (truth !== null && question.numeric?.truth !== null && question.numeric) {
    const numeric = question.numeric;
    const fair = rows.filter(
      (row) =>
        row.error !== null &&
        !(numeric.overIsBust && (row.response.value ?? 0) > truth),
    );
    const closest = uniqueBest(fair, (row) => row.error ?? 0, "lowest");
    if (closest) {
      cards.push(
        card(question, {
          id: id("closest"),
          facet: "closest",
          tone: "record",
          icon: "target",
          headline:
            closest.error === 0
              ? `Bullseye: ${closest.player.nickname} got it exactly`
              : `Closest: ${closest.player.nickname}`,
          detail:
            closest.error === 0
              ? `Exactly ${formatValue(truth, numeric.unit)}. Suspicious.`
              : `${formatValue(closest.response.value ?? 0, numeric.unit)}, just ${formatValue(closest.error ?? 0, numeric.unit)} off.`,
          figure: {
            value: formatValue(closest.response.value ?? 0, numeric.unit),
            caption: "closest guess",
          },
          bars: [],
          score: closest.error === 0 ? 62 : 40,
          members: [closest.player.playerId],
        }),
      );
    }
    const wildest = uniqueBest(
      rows.filter((row) => row.error !== null),
      (row) => row.error ?? 0,
      "highest",
    );
    if (wildest && truth !== 0 && (wildest.error ?? 0) / Math.abs(truth) >= 1) {
      cards.push(
        card(question, {
          id: id("wildest"),
          facet: "wildest",
          tone: "answer",
          icon: "dice",
          headline: `Someone guessed ${formatValue(wildest.response.value ?? 0, numeric.unit)}`,
          detail: `That is ${Math.round(((wildest.error ?? 0) / Math.abs(truth)) * 10) / 10} times the answer away. We won't say who.`,
          figure: {
            value: formatValue(wildest.response.value ?? 0, numeric.unit),
            caption: "wildest guess",
          },
          bars: [],
          score: 44,
          members: [],
        }),
      );
    }
  } else if (
    question.numeric &&
    (question.numeric.better === "lower" || question.numeric.better === "higher")
  ) {
    const numeric = question.numeric;
    const best = uniqueBest(
      rows.filter((row) => row.response.value !== null),
      (row) => row.response.value ?? 0,
      numeric.better === "lower" ? "lowest" : "highest",
    );
    if (best) {
      cards.push(
        card(question, {
          id: id("best"),
          facet: "best",
          tone: "record",
          icon: "trophy",
          headline: `Best ${numeric.noun}: ${best.player.nickname}`,
          detail: `${formatValue(best.response.value ?? 0, numeric.unit)}. Take a bow.`,
          figure: {
            value: formatValue(best.response.value ?? 0, numeric.unit),
            caption: `best ${numeric.noun}`,
          },
          bars: [],
          score: 38,
          members: [best.player.playerId],
        }),
      );
    }
  }
  return cards;
}

function facetCards(
  question: TrendQuestion,
  rows: readonly Row[],
  facet: Facet,
  context: FacetContext,
  truth: number | null,
): RankedTrendCard[] {
  const keyed = rows
    .map((row) => ({ row, key: facet.key(row, context) }))
    .filter((item): item is { row: Row; key: string } => item.key !== null);
  const groups = new Map<string, Row[]>();
  for (const item of keyed)
    groups.set(item.key, [...(groups.get(item.key) ?? []), item.row]);
  if (groups.size < 2) return [];
  const comparisons: {
    key: string;
    inside: Row[];
    outside: Row[];
    outsideName: string;
  }[] = [];
  if (facet.compare === "pair") {
    const [first, second] = [...groups.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    );
    if (!first || !second) return [];
    comparisons.push({
      key: first[0],
      inside: first[1],
      outside: second[1],
      outsideName: facet.name(second[0]),
    });
    comparisons.push({
      key: second[0],
      inside: second[1],
      outside: first[1],
      outsideName: facet.name(first[0]),
    });
  } else {
    for (const [key, inside] of groups) {
      const outside = keyed.filter((item) => item.key !== key).map((item) => item.row);
      const otherKeys = [...groups.keys()].filter((other) => other !== key);
      comparisons.push({
        key,
        inside,
        outside,
        outsideName:
          otherKeys.length === 1 ? facet.name(otherKeys[0]!) : "everyone else",
      });
    }
  }
  const cards: RankedTrendCard[] = [];
  for (const comparison of comparisons) {
    const { inside, outside } = comparison;
    if (inside.length < trendMinimumGroup || outside.length < trendMinimumGroup)
      continue;
    const name = facet.name(comparison.key);
    const size = Math.sqrt(Math.min(1, Math.min(inside.length, outside.length) / 8));
    const id = (measure: string) =>
      `${question.questionId}:${facet.id}:${measure}:${comparison.key}`.slice(0, 120);
    const members = inside.map((row) => row.player.playerId);
    const base = {
      facet: facet.id,
      tone: facet.tone as TrendTone,
      icon: facetIcon(facet, comparison.key),
      members,
    };
    if (question.scored) {
      const judgedIn = inside.filter((row) => row.response.correct !== null);
      const judgedOut = outside.filter((row) => row.response.correct !== null);
      if (
        judgedIn.length >= trendMinimumGroup &&
        judgedOut.length >= trendMinimumGroup
      ) {
        const rateIn =
          judgedIn.filter((row) => row.response.correct).length / judgedIn.length;
        const rateOut =
          judgedOut.filter((row) => row.response.correct).length / judgedOut.length;
        if (rateIn - rateOut >= 0.15) {
          cards.push(
            card(question, {
              ...base,
              id: id("success"),
              headline: successHeadline(
                facet.id,
                comparison.key,
                name,
                comparison.outsideName,
              ),
              detail: `${percent(rateIn, 1)}% of ${name} ${question.success}, against ${percent(rateOut, 1)}% of ${comparison.outsideName}.`,
              figure: {
                value: `${percent(rateIn, 1)}%`,
                caption: clip(`of ${name}`, 48),
              },
              bars: [
                bar(name, rateIn, true),
                bar(comparison.outsideName, rateOut, false),
              ],
              score: scoreFor(rateIn - rateOut, size, facet.weight, 1.1),
            }),
          );
        }
      }
    }
    if (question.options.length > 0) {
      let bestOption: { key: string; rateIn: number; rateOut: number } | null = null;
      const keys = new Set(inside.flatMap((row) => row.response.picks));
      for (const key of keys) {
        if (!labelOf(question, key)) continue;
        const rateIn =
          inside.filter((row) => row.response.picks.includes(key)).length /
          inside.length;
        const rateOut =
          outside.filter((row) => row.response.picks.includes(key)).length /
          outside.length;
        if (rateIn < 0.3 || rateIn - rateOut < 0.2) continue;
        if (!bestOption || rateIn - rateOut > bestOption.rateIn - bestOption.rateOut) {
          bestOption = { key, rateIn, rateOut };
        }
      }
      if (bestOption) {
        const label = labelOf(question, bestOption.key)!;
        cards.push(
          card(question, {
            ...base,
            id: id(`pick:${bestOption.key}`),
            headline: pickHeadline(
              facet.id,
              comparison.key,
              name,
              question.pickVerb,
              label,
            ),
            detail: `${percent(bestOption.rateIn, 1)}% of ${name} ${question.pickVerb} ${clip(label, 60)}; only ${percent(bestOption.rateOut, 1)}% of ${comparison.outsideName} did.`,
            figure: {
              value: `${percent(bestOption.rateIn, 1)}%`,
              caption: clip(`of ${name}`, 48),
            },
            bars: [
              bar(name, bestOption.rateIn, true),
              bar(comparison.outsideName, bestOption.rateOut, false),
            ],
            score: scoreFor(
              bestOption.rateIn - bestOption.rateOut,
              size,
              facet.weight,
              1,
            ),
          }),
        );
      }
    }
    if (question.numeric) {
      const numeric = question.numeric;
      const guessing = numeric.better === "closer" || numeric.better === null;
      const measures: {
        measure: "miss" | "level";
        read: (row: Row) => number | null;
        wins: (effect: number) => boolean;
      }[] = [];
      if (numeric.better === "closer" && truth !== null && numeric.truth !== null) {
        measures.push({
          measure: "miss",
          read: (row) => row.error,
          wins: (effect) => effect < 0,
        });
      }
      measures.push({
        measure: "level",
        read: (row) => row.response.value,
        wins: (effect) => (numeric.better === "lower" ? effect < 0 : effect > 0),
      });
      for (const { measure, read, wins } of measures) {
        const valuesIn = inside
          .map(read)
          .filter((value): value is number => value !== null);
        const valuesOut = outside
          .map(read)
          .filter((value): value is number => value !== null);
        if (valuesIn.length < trendMinimumGroup || valuesOut.length < trendMinimumGroup)
          continue;
        const meanIn = mean(valuesIn);
        const meanOut = mean(valuesOut);
        const spread = Math.sqrt((variance(valuesIn) + variance(valuesOut)) / 2) || 1;
        const effect = (meanIn - meanOut) / spread;
        const relative = Math.abs(meanIn - meanOut) / Math.max(Math.abs(meanOut), 1e-9);
        if (Math.abs(effect) < 0.4 || relative < 0.05 || !wins(effect)) continue;
        const unit = numeric.unit;
        const headline =
          measure === "miss"
            ? `${capital(name)} were the sharper guessers`
            : guessing
              ? `${capital(name)} guessed higher`
              : numeric.better === "lower"
                ? `${capital(name)} were quicker`
                : `${capital(name)} scored more`;
        const label = measure === "miss" ? "average miss" : `average ${numeric.noun}`;
        cards.push(
          card(question, {
            ...base,
            id: id(measure === "miss" ? "miss" : "level"),
            headline,
            detail: `${capital(name)}: ${label} ${formatValue(meanIn, unit)}. ${capital(comparison.outsideName)}: ${formatValue(meanOut, unit)}.`,
            figure: { value: formatValue(meanIn, unit), caption: clip(label, 48) },
            bars: numericBars(name, meanIn, comparison.outsideName, meanOut, unit),
            score: scoreFor(
              Math.min(1, Math.abs(effect) / 2),
              size,
              facet.weight,
              measure === "miss" ? 1 : 0.9,
            ),
          }),
        );
      }
    }
    if (question.timed && facet.id !== "speed" && facet.id !== "buzzer") {
      const timesIn = inside
        .map((row) => row.response.elapsedMs)
        .filter((value): value is number => value !== null);
      const timesOut = outside
        .map((row) => row.response.elapsedMs)
        .filter((value): value is number => value !== null);
      if (timesIn.length >= trendMinimumGroup && timesOut.length >= trendMinimumGroup) {
        const meanIn = mean(timesIn) / 1000;
        const meanOut = mean(timesOut) / 1000;
        const spread =
          Math.sqrt((variance(timesIn) + variance(timesOut)) / 2) / 1000 || 1;
        const effect = (meanOut - meanIn) / spread;
        if (effect >= 0.6 && meanOut - meanIn >= 1) {
          cards.push(
            card(question, {
              ...base,
              id: id("quick"),
              headline: `${capital(name)} answered quicker`,
              detail: `${meanIn.toFixed(1)}s on average, against ${meanOut.toFixed(1)}s for ${comparison.outsideName}.`,
              figure: { value: `${meanIn.toFixed(1)}s`, caption: "average answer" },
              bars: numericBars(name, meanIn, comparison.outsideName, meanOut, "s"),
              score: scoreFor(Math.min(1, effect / 2.5), size, facet.weight, 0.6),
            }),
          );
        }
      }
    }
  }
  return cards;
}

function successHeadline(
  facet: string,
  key: string,
  name: string,
  outside: string,
): string {
  if (facet === "platform") {
    if (key === "iphone") return "Team iPhone out-thought Team Android";
    if (key === "android") return "Team Android out-thought Team iPhone";
  }
  if (facet === "theme")
    return key === "dark" ? "The dark side knew best" : "Light mode, bright minds";
  if (facet === "speed")
    return key === "fast"
      ? "Quick and correct: speed paid off"
      : "Slow and steady won this one";
  if (facet === "buzzer")
    return key === "late"
      ? "Last-second panic actually worked"
      : "No need to panic: early answers won";
  if (facet === "standing")
    return key === "top"
      ? "The leaders showed why they lead"
      : "The chasing pack is coming";
  if (facet === "trolls")
    return key === "troll"
      ? "Karma? The trolls got it right"
      : "Clean hands, right answers";
  if (facet === "streak")
    return key === "hot"
      ? "On a streak: last round's winners did it again"
      : "Comeback: last round's strugglers bounced back";
  if (facet === "software")
    return key === "newest"
      ? "Updated phones, updated brains"
      : "Out-of-date phones, up-to-date brains";
  if (facet === "language")
    return key === "us"
      ? "The American-English phones knew this one"
      : `${capital(name)} nailed it`;
  return `${capital(name)} beat ${outside}`;
}

function pickHeadline(
  facet: string,
  key: string,
  name: string,
  verb: string,
  label: string,
): string {
  const short = clip(label, 44);
  if (facet === "platform" && (key === "iphone" || key === "android")) {
    return `Team ${key === "iphone" ? "iPhone" : "Android"} ${verb} ${short}`;
  }
  if (facet === "theme" && key === "dark") return `The dark side ${verb} ${short}`;
  if (facet === "standing")
    return `${key === "top" ? "The leaders" : "The chasing pack"} ${verb} ${short}`;
  if (facet === "trolls" && key === "troll") return `The trolls ${verb} ${short}`;
  return `${capital(name)} ${verb} ${short}`;
}

function facetIcon(facet: Facet, key: string): TrendIcon {
  if (facet.id === "platform") {
    return key === "android"
      ? "android"
      : key === "desktop"
        ? "laptop"
        : key === "ipad"
          ? "tablet"
          : "apple";
  }
  if (facet.id === "theme") return key === "dark" ? "moon" : "sun";
  if (facet.id === "speed") return key === "fast" ? "zap" : "hourglass";
  return facet.icon;
}

function card(
  question: TrendQuestion,
  fields: Omit<RankedTrendCard, "headline" | "detail" | "id" | "score"> & {
    id: string;
    headline: string;
    detail: string;
    score: number;
  },
): RankedTrendCard {
  void question;
  return {
    ...fields,
    // Typed answers can put spaces or accents in an id; the host's hide
    // command only accepts this safe alphabet.
    id: fields.id.replace(/[^A-Za-z0-9:_.-]/g, "_").slice(0, 120),
    headline: clip(fields.headline, 120),
    detail: clip(fields.detail, 220),
    figure: fields.figure
      ? {
          value: clip(fields.figure.value, 16),
          caption: clip(fields.figure.caption, 48),
        }
      : null,
    score: Math.round(Math.max(0, Math.min(100, fields.score)) * 10) / 10,
  };
}

function scoreFor(gap: number, size: number, weight: number, measure: number): number {
  return Math.min(100, 30 + gap * 80 * size * weight * measure);
}

function bar(label: string, rate: number, highlight: boolean) {
  return {
    label: clip(capital(label), 40),
    value: Math.round(Math.max(0, Math.min(1, rate)) * 100),
    display: `${percent(rate, 1)}%`,
    highlight,
  };
}

function numericBars(
  nameIn: string,
  valueIn: number,
  nameOut: string,
  valueOut: number,
  unit: string,
) {
  const top = Math.max(Math.abs(valueIn), Math.abs(valueOut), 1e-9);
  return [
    {
      label: clip(capital(nameIn), 40),
      value: Math.round((Math.abs(valueIn) / top) * 100),
      display: clip(formatValue(valueIn, unit), 16),
      highlight: true,
    },
    {
      label: clip(capital(nameOut), 40),
      value: Math.round((Math.abs(valueOut) / top) * 100),
      display: clip(formatValue(valueOut, unit), 16),
      highlight: false,
    },
  ];
}

function optionBars(
  question: TrendQuestion,
  ranked: [string, number][],
  total: number,
) {
  return ranked
    .filter(([key]) => labelOf(question, key))
    .slice(0, 4)
    .map(([key, count], index) => ({
      label: clip(labelOf(question, key)!, 40),
      value: percent(count, total),
      display: `${percent(count, total)}%`,
      highlight: index === 0,
    }));
}

function pickCounts(
  question: TrendQuestion,
  rows: readonly Row[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const key of new Set(row.response.picks)) {
      if (!labelOf(question, key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function membersPicking(rows: readonly Row[], key: string): string[] {
  return rows
    .filter((row) => row.response.picks.includes(key))
    .map((row) => row.player.playerId);
}

function labelOf(question: TrendQuestion, key: string): string | null {
  return question.options.find((option) => option.id === key)?.label ?? null;
}

function uniqueBest(
  rows: readonly Row[],
  read: (row: Row) => number,
  direction: "lowest" | "highest",
): Row | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((left, right) =>
    direction === "lowest" ? read(left) - read(right) : read(right) - read(left),
  );
  const [first, second] = sorted;
  if (!first || (second && read(second) === read(first))) return null;
  return first;
}

export function formatValue(value: number, unit: string): string {
  const rounded = (places: number) =>
    (Math.round(value * 10 ** places) / 10 ** places).toLocaleString("en-GB", {
      maximumFractionDigits: places,
    });
  if (unit === "£") {
    return Math.abs(value) < 100
      ? `£${(Math.round(value * 100) / 100).toFixed(2)}`
      : `£${rounded(0)}`;
  }
  if (unit === "p") return `${rounded(0)}p`;
  if (unit === "p/litre") return `${rounded(0)}p a litre`;
  if (unit === "/100") return `${rounded(0)}/100`;
  if (unit === "s") return `${rounded(1)}s`;
  if (unit === "guesses") return `${rounded(1)} ${value === 1 ? "guess" : "guesses"}`;
  if (unit === "pts") return `${rounded(0)} pts`;
  return unit ? `${rounded(1)} ${unit}` : rounded(1);
}

function percent(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return (
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function capital(text: string): string {
  // "iPhone users" and "iPad players" keep their brand casing.
  if (/^i[A-Z]/.test(text)) return text;
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
}

/** Every facet id, for the admin page's legend and tests. */
export const trendFacetIds = facets.map((facet) => facet.id);
