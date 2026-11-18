import { guessQuestion } from "../../authoring.ts";

export const guessairportlounge = guessQuestion({
  id: "guess-airport-lounge",
  title: "Airport lounge behaviour",
  prompt:
    "Who would miss their flight because they were arguing that the airport lounge buffet counts as an all-inclusive holiday?",
  instructions:
    "Pick the guest most likely to do this. The room’s most popular pick wins.",
  scoring: "majority",
  selfVote: "allowed",
  notes:
    "Fictional scenario; no claim about an actual guest. Created at the user’s request on 16 November 2026.",
});
