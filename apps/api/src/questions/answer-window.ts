import { kartOpenRaceMs } from "@26/shared";

/**
 * How long the room keeps a question's answering phase open. A kart race is
 * open-ended: it ends when every guest has finished or the host ends it, so its
 * window is the open-race ceiling instead of the authored race length. The race
 * clock is read from this window, so every room that schedules a kart round must
 * use this value.
 */
export function answerWindowMs(question: { kind: string; collectMs: number }): number {
  return question.kind === "kart" ? kartOpenRaceMs : question.collectMs;
}
