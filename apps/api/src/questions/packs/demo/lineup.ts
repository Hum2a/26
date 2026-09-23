import { rankQuestion } from "../../authoring.ts";

export const lineup = rankQuestion({
  id: "lineup",
  title: "Party order",
  status: "ready",
  prompt: "Illustrative demo: put these in the party order.",
  points: 80,
  collectMs: 30_000,
  attribution: "after",
  mode: "complete",
  ties: "forbidden",
  items: [
    { id: "cake", label: "Cake" },
    { id: "candles", label: "Candles" },
    { id: "song", label: "Song" },
    { id: "friends", label: "Friends" },
  ],
  tiers: [
    { id: "first", label: "1st" },
    { id: "second", label: "2nd" },
    { id: "third", label: "3rd" },
    { id: "fourth", label: "4th" },
  ],
  truth: {
    known: [
      { tierId: "first", itemIds: ["friends"] },
      { tierId: "second", itemIds: ["cake"] },
      { tierId: "third", itemIds: ["song"] },
      { tierId: "fourth", itemIds: ["candles"] },
    ],
  },
});
