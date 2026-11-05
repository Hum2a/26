import type { RoomPhaseName } from "@26/shared";

const labels: Record<RoomPhaseName, string> = {
  lobby: "Lobby",
  intro: "Get ready",
  prompt: "Question up",
  predict: "Predictions open",
  collect: "Answers open",
  vote: "Voting open",
  reveal: "Answer reveal",
  scores: "Scores",
  final: "Final standings",
  facts: "Fun facts",
  podium: "Podium",
};

/** Plain words for a room phase, for screens people read rather than logs. */
export function phaseLabel(phase: RoomPhaseName | string): string {
  return labels[phase as RoomPhaseName] ?? phase;
}
