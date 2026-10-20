import { voteQuestion } from "../../authoring.ts";

export const datingExitExcuse = voteQuestion({
  id: "dating-exit-excuse",
  title: "Speed dating icebreaker roulette",
  prompt:
    "You're 10 minutes into a first date in Central London and they say: ‘Honestly, I think astrology has more predictive validity than peer-reviewed economics.’ What is your exact exit excuse?",
  instructions:
    "You have 30 seconds to write an exit line. The room awards Most Smooth, Most Brutal and Instantly Causes a Scene.",
  collectMs: 30_000,
  points: 180,
  flow: {
    kind: "awards",
    labels: ["Most Smooth", "Most Brutal", "Instantly Causes a Scene"],
  },
  explanation:
    "One line, three awards. Each category is worth 60 points to its winning author or tied authors. The same line can win more than one award; no self-votes.",
  notes:
    "Thirty seconds to write one line, then three server-timed ballots over the same frozen entries. 20 seconds per category; 60 points per category, up to 180 total. Ties share the category win, no ballots means no award. Each ballot has a durable epoch so old retries cannot vote in a later category.",
});
