import { voteQuestion } from "../../authoring.ts";

export const heathrowSearchQuery = voteQuestion({
  id: "heathrow-search-query",
  title: "Most likely to get you flagged at Heathrow",
  prompt:
    "Write the worst possible search query to find on someone’s phone right before going through UK border control.",
  instructions:
    "Write a fictional search query. The room will compare submissions head-to-head.",
  requirements: [
    {
      code: "options",
      name: "pairwise-voting",
      detail:
        "Blind 1v1 submission pairing, stage presentation, voting eligibility, bracket progression, ties/byes and final winner scoring. The current all-submissions ballot does not implement this.",
    },
  ],
  notes:
    "Jackbox-style blind writing, then TV displays submissions in 1v1 match-ups and guests vote for the query most likely to trigger secondary screening. Fictional comedy premise, not a claim about actual border screening rules. Ordinary vote is a placeholder; do not silently switch to one all-room ballot. See docs/content/party-concepts.md.",
});
