import { rankQuestion } from "../../authoring.ts";

// Design brief: a rage meter. Phones drag each trigger up a heat scale; the
// stage fills the meter from the fastest to the slowest.
export const ignoranceTriggers = rankQuestion({
  id: "ignorance-triggers",
  presentation: "rage-meter",
  title: "Conversational triggers",
  prompt:
    "Rank these conversational triggers by what type of ignorance pisses Humza off the fastest.",
  items: [
    { id: "apple", label: "Apple" },
    { id: "conspiracy", label: "Conspiracy theories" },
    { id: "palm-beach-pete", label: "Palm Beach Pete" },
    { id: "politics", label: "Politics" },
  ],
  tiers: [
    { id: "first", label: "Fastest" },
    { id: "second", label: "2nd" },
    { id: "third", label: "3rd" },
    { id: "fourth", label: "Slowest" },
  ],
  truth: {
    known: [
      { tierId: "first", itemIds: ["apple"] },
      { tierId: "second", itemIds: ["palm-beach-pete"] },
      { tierId: "third", itemIds: ["politics"] },
      { tierId: "fourth", itemIds: ["conspiracy"] },
    ],
  },
});
