import { guessQuestion } from "../../authoring.ts";

export const guesscouncilcoup = guessQuestion({
  id: "guess-council-coup",
  title: "The residents’ WhatsApp coup",
  prompt:
    "Who would stage a coup in the residents’ WhatsApp, declare martial law over the bins, then get removed by their mum?",
  instructions:
    "Pick the guest most likely to do this. The room’s most popular pick wins.",
  scoring: "majority",
  selfVote: "allowed",
  notes:
    "Fictional scenario; no claim about an actual guest. Created at the user’s request on 16 November 2026.",
});
