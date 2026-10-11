import type { AttributionMode } from "./definition.ts";

/** The only list of ordinary question defaults. Helpers apply these when a caller omits them. */
export const standardPresentation = "standard";

export const ordinaryDefaults = {
  collectMs: 20_000,
  attribution: "after" as AttributionMode,
  presentation: standardPresentation,
  speedBonus: null as { maxPoints: number } | null,
  choicePoints: 100,
  pollPoints: 0,
  sliderPoints: 100,
  typedPoints: 100,
  typedMaxLength: 60,
  rankPoints: 80,
  rankMode: "complete" as const,
  rankTies: "forbidden" as const,
  votePoints: 60,
  voteMs: 20_000,
  voteCandidateMode: "all" as const,
  selfVote: "forbidden" as const,
  voteAward: "authors" as const,
  guessPoints: 80,
  guessRoster: "room" as const,
  guessScoring: "named" as const,
  duelPoints: 50,
  finalePoints: 70,
  predictionPoints: 30,
  predictMs: 20_000,
  tie: "shared" as const,
  lateJoin: "ineligible" as const,
  absence: "forfeit" as const,
  odd: "solo" as const,
  tieBreak: "off" as const,
  within: 0,
};
