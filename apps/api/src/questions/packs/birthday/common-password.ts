import { typedQuestion } from "../../authoring.ts";

// Authoring placeholder only: an ordinary typed correct-answer question cannot
// rank entries by commonness. Explicit gaps prevent this draft becoming playable.
export const commonPassword = typedQuestion({
  id: "common-password",
  title: "Create the most common password",
  prompt: "Create the most common password",
  instructions:
    "Make up a password for this round. Do not enter a password you use elsewhere.",
  status: "draft",
  notes:
    "Confirmed: commonness means matching other guests' made-up passwords. Rank guests by the frequency of their submitted password in this room and award points. This is not ordinary fixed accepted-answer matching. Case/spacing rules, ties and the rank-to-points schedule still need defining.",
  requirements: [
    {
      code: "truth",
      name: "matching-rules",
      detail:
        "case/spacing rules and tied-rank handling for matching other guests' made-up passwords.",
    },
    {
      code: "truth",
      name: "ranking-mechanic",
      detail:
        "a server-authoritative commonness-ranking mechanic and agreed points schedule; the existing typed mechanic does not implement these.",
    },
  ],
  accepted: {
    missing: {
      code: "correct-answer",
      name: "commonness-scoring",
      detail:
        "the room-frequency ranking and points implementation; no fixed accepted answer is being substituted.",
    },
  },
});
