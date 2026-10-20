import { voteQuestion } from "../../authoring.ts";

export const datingExitExcuse = voteQuestion({
  id: "dating-exit-excuse",
  title: "Speed dating icebreaker roulette",
  prompt:
    "You're 10 minutes into a first date in Central London and they say: ‘Honestly, I think astrology has more predictive validity than peer-reviewed economics.’ What is your exact exit excuse?",
  instructions:
    "You have 30 seconds to write an exit line. The room awards Most Smooth, Most Brutal and Instantly Causes a Scene.",
  collectMs: 30_000,
  requirements: [
    {
      code: "options",
      name: "multi-award-voting",
      detail:
        "Three independent award ballots over the same submitted lines, category-specific winners, eligibility/ties and points. A single generic vote cannot award all three categories.",
    },
  ],
  notes:
    "Submit one opening/exit line, then vote in the three user-named categories: Most Smooth; Most Brutal; Instantly Causes a Scene. Keep the requested 30-second writing window. Current one-ballot vote is only an authoring placeholder. No new categories, extra submission rounds or points schedule invented. See docs/content/party-concepts.md.",
});
