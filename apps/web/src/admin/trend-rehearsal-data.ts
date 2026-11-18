import type {
  TrendDevice,
  TrendInput,
  TrendPlayer,
  TrendResponse,
} from "@26/shared";

/**
 * Stand-in rooms for rehearsing answer trends with no guests. The numbers
 * are made up and labelled as such; they feed the real analysis engine and
 * the real projector and phone components. Nothing reaches a room.
 */
export type TrendScenario = "choice" | "slider" | "kart";

export const trendScenarios: { id: TrendScenario; label: string }[] = [
  { id: "choice", label: "Multiple choice" },
  { id: "slider", label: "Price guess" },
  { id: "kart", label: "Kart race" },
];

export function rehearsalTrendInput(scenario: TrendScenario, seed: number): TrendInput {
  const random = mulberry32(seed);
  const players: TrendPlayer[] = Array.from({ length: 24 }, (_, index) => {
    const iphone = random() < 0.6;
    const device: TrendDevice = {
      family: iphone ? "iphone" : "android",
      os: iphone ? "iOS" : "Android",
      osMajor: iphone ? (random() < 0.7 ? 18 : 17) : 14,
      browser: iphone ? (random() < 0.85 ? "safari" : "chrome") : "chrome",
      colorScheme: random() < 0.55 ? "dark" : "light",
      reducedMotion: random() < 0.15 ? "reduce" : "no-preference",
      language: random() < 0.75 ? "en-GB" : random() < 0.6 ? "en-US" : "fr-FR",
      timeZone: random() < 0.85 ? "Europe/London" : "Europe/Paris",
      shortEdge: random() < 0.4 ? 430 : 390,
      pixelRatio: random() < 0.7 ? 3 : 2.6,
      orientation: "portrait",
      memoryGb: iphone ? null : random() < 0.5 ? 8 : 4,
      quality: "4g",
      saveData: false,
    };
    return {
      playerId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      nickname: `Stand-in ${index + 1}`,
      joinOrder: index,
      device,
      reconnects: random() < 0.2 ? 1 : 0,
      rttMs: Math.round(40 + random() * 220),
      scoreBefore: Math.round(random() * 900),
      trollsSent: random() < 0.3 ? 1 : 0,
      trollsReceived: random() < 0.3 ? 1 : 0,
      sharedPhoto: random() < 0.25,
      hasAvatar: random() < 0.5,
      previousCorrect: random() < 0.5,
    };
  });
  const responses: TrendResponse[] = players.map((player) => {
    const apple = player.device?.family === "iphone";
    const dark = player.device?.colorScheme === "dark";
    const elapsedMs = Math.round(1_500 + random() * 17_000);
    if (scenario === "slider") {
      const value = Math.round(35 + (apple ? 6 : -4) + (random() - 0.5) * 30);
      return {
        playerId: player.playerId,
        picks: [],
        value,
        correct: Math.abs(value - 35) <= 5,
        points: Math.abs(value - 35) <= 5 ? 100 : 0,
        elapsedMs,
        windowMs: 20_000,
        device: player.device,
      };
    }
    if (scenario === "kart") {
      const finished = random() < 0.85;
      return {
        playerId: player.playerId,
        picks: [],
        value: finished
          ? Math.round((58 + (apple ? -3 : 2) + random() * 12) * 10) / 10
          : null,
        correct: finished,
        points: finished ? Math.round(random() * 100) : 0,
        elapsedMs: null,
        windowMs: null,
        device: player.device,
      };
    }
    const roll = random();
    const pick = dark
      ? roll < 0.6
        ? "mudkip"
        : roll < 0.85
          ? "turtwig"
          : "tepig"
      : roll < 0.35
        ? "mudkip"
        : roll < 0.7
          ? "tepig"
          : roll < 0.95
            ? "turtwig"
            : "osama";
    return {
      playerId: player.playerId,
      picks: [pick],
      value: null,
      correct: pick === "mudkip",
      points: pick === "mudkip" ? 100 : 0,
      elapsedMs,
      windowMs: 20_000,
      device: player.device,
    };
  });
  const question: TrendInput["question"] =
    scenario === "slider"
      ? {
          questionId: "rehearsal-slider",
          kind: "slider",
          prompt: "Stand-in: guess the price of a Freddo",
          options: [],
          pickVerb: "guessed",
          numeric: { noun: "guess", unit: "p", better: "closer", truth: 35 },
          scored: true,
          success: "scored",
          timed: true,
        }
      : scenario === "kart"
        ? {
            questionId: "rehearsal-kart",
            kind: "kart",
            prompt: "Stand-in: one-lap kart sprint",
            options: [],
            pickVerb: "finished",
            numeric: { noun: "finish time", unit: "s", better: "lower", truth: null },
            scored: true,
            success: "finished the race",
            timed: false,
          }
        : {
            questionId: "rehearsal-choice",
            kind: "choice",
            prompt: "Stand-in: favourite Pokémon",
            options: [
              { id: "turtwig", label: "Turtwig" },
              { id: "mudkip", label: "Mudkip" },
              { id: "tepig", label: "Tepig" },
              { id: "osama", label: "A very wrong answer" },
            ],
            pickVerb: "picked",
            numeric: null,
            scored: true,
            success: "got it right",
            timed: true,
          };
  return {
    question,
    players,
    responses,
    history: [
      { questionId: "earlier-1", accuracy: 0.62 },
      { questionId: "earlier-2", accuracy: 0.48 },
    ],
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
