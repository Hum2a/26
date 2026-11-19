import type { PlaySnapshot } from "@26/shared";

/** Phone label suffix at the reveal: the right answer, or the room's count and who scored. */
export function choiceNote(
  reveal: Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "choice" }> | undefined,
  optionId: string,
): string {
  if (!reveal) {
    return "";
  }
  if (reveal.correctOptionId === optionId) {
    return " — the answer";
  }
  const count = reveal.tally?.find((row) => row.optionId === optionId)?.count;
  const tally =
    count === undefined ? "" : ` — ${count} ${count === 1 ? "vote" : "votes"}`;
  const scored =
    reveal.everyone || reveal.winners?.includes(optionId) ? ", scored" : "";
  return `${tally}${scored}`;
}
