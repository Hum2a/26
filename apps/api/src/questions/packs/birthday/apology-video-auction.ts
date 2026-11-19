import { voteQuestion } from "../../authoring.ts";

export const apologyVideoAuction = voteQuestion({
  id: "apology-video-auction",
  title: "The apology video auction",
  prompt:
    "You were caught on 4K camera at a Selfridges changing room doing something unspeakable. Write the first sentence of your Notes App apology.",
  instructions:
    "Write a fictional apology. The room votes head-to-head on who avoids jail time.",
  collectMs: 30000,
  voteMs: 15000,
  flow: {
    kind: "tournament",
    pick: "Pick the more convincing apology.",
    // 80 entries would be 79 one-at-a-time matches (about 25 minutes). Every
    // phone judges 5 pairs of its own at once, then the best 8 play it out on
    // the big screen: 7 matches, about 3½ minutes in all.
    heat: { finalists: 8, pairs: 5, ms: 45_000 },
  },
  attribution: "after",
  explanation:
    "The most convincing apology wins the bracket and 60 points. No self-votes. Tied matches use the frozen random draw; odd entries get a bye. No votes means no prize.",
  notes:
    "Fictional scenario, with no actual guest or public figure accused. Uses the existing anonymous pairwise tournament. “Auction” is the supplied title; no money/bidding mechanic was requested.",
});
