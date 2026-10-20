import { playSnapshotSchema, type PlaySnapshot } from "@26/shared";

export type RehearsalPhase = "prompt" | "collect" | "vote";

export function rehearsalPhase(
  value: string | null,
  question: PlaySnapshot["question"],
): RehearsalPhase {
  return value === "prompt"
    ? "prompt"
    : value === "vote" && question.kind === "vote"
      ? "vote"
      : "collect";
}

/** Shared isolated fixtures for the actual phone and stage renderers. Never supplies reveals or scores. */
export function rehearsalPlay(
  question: PlaySnapshot["question"],
  phase: RehearsalPhase,
  {
    answer = null,
    ballot = null,
    beat = 0,
  }: {
    answer?: PlaySnapshot["selfAnswer"];
    ballot?: PlaySnapshot["selfBallot"];
    beat?: number;
  } = {},
): PlaySnapshot {
  return playSnapshotSchema.parse({
    question,
    selfAnswer: answer,
    selfBallot: ballot,
    submissionCount: answer || ballot ? 1 : 0,
    ballot:
      question.kind === "vote" && phase === "vote"
        ? {
            total: question.flow === "tournament" ? 2 : 3,
            reason: "open",
            epoch: beat,
            label:
              question.flow === "awards"
                ? ["Most Smooth", "Most Brutal", "Instantly Causes a Scene"][beat % 3]
                : `Stand-in match ${beat + 1}`,
            instruction:
              "Stand-in submissions only. This rehearsal does not settle winners or award points.",
            cards: [1, 2, 3]
              .slice(0, question.flow === "tournament" ? 2 : 3)
              .map((value) => ({
                id: `preview-${beat}-${value}`,
                label: `Sample line ${value}`,
                own: false,
                selectable: true,
                author: null,
              })),
          }
        : question.kind === "guess"
          ? {
              total: 3,
              reason: phase === "collect" ? "open" : "closed",
              cards: [1, 2, 3].map((value) => ({
                id: `preview-${value}`,
                label: `Sample guest ${value}`,
                own: false,
                selectable: true,
                author: null,
              })),
            }
          : null,
    duel:
      question.kind === "duel" || question.kind === "finale"
        ? {
            role: "solo",
            reason: phase === "collect" ? "open" : "waiting",
            opponentId: null,
            opponent: null,
            board: null,
            cards: [],
          }
        : null,
    reveal: null,
    selfAward: null,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
    explanation: null,
  });
}
