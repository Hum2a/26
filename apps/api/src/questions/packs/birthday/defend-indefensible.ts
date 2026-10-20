import { voteQuestion } from "../../authoring.ts";

export const defendIndefensible = voteQuestion({
  id: "defend-indefensible",
  title: "Defend the indefensible",
  prompt: "Why charging guests £5 for toilet paper at a house party is sound economics",
  instructions:
    "Two randomly paired players have 45 seconds to pitch. The room votes for the more convincing case.",
  collectMs: 45000,
  requirements: [
    {
      code: "truth",
      name: "live-debate",
      detail:
        "Implement random contestant pairing, a 45-second spoken debate beat and a spectator ballot; text submission is not the finished live pitch mechanic.",
    },
  ],
  notes:
    "User topics: £5 toilet paper at a house party; replace all British roundabouts with four-way stops; cold baked beans from the tin as gourmet bachelor food; anime filler better than canon. Use 45 seconds from the mechanic, despite the 60-Second title. This vote definition is a disabled authoring placeholder, not a text substitute.",
});
