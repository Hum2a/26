import { voteQuestion } from "../../authoring.ts";

export const heathrowSearchQuery = voteQuestion({
  id: "heathrow-search-query",
  title: "Most likely to get you flagged at Heathrow",
  prompt:
    "Write the worst possible search query to find on someone’s phone right before going through UK border control.",
  instructions:
    "Write a fictional search query. The room will compare submissions head-to-head.",
  collectMs: 30_000,
  voteMs: 15_000,
  attribution: "after",
  flow: { kind: "tournament" },
  explanation:
    "The worst search wins the bracket and 60 points. No self-votes. Odd entries get a bye; tied matches use the random draw fixed before voting. No votes in the entire bracket means no prize.",
  notes:
    "Fictional comedy, not actual border-screening rules. All accepted eligible lines enter a seeded knockout: one blind 1v1 on stage and phones per 15-second ballot. Winner author gets 60. Frozen seed/order handles ties and byes; no anonymous mutable state. Large rooms mean more matches; host can advance each beat.",
});
