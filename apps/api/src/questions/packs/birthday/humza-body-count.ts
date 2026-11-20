import { choiceQuestion } from "../../authoring.ts";

export const humzaBodyCount = choiceQuestion({
  id: "humza-body-count",
  title: "Humza's body count",
  prompt: "What's Humza's body count?",
  instructions: "Pick one, then send.",
  options: [
    { id: "8", label: "8" },
    { id: "14", label: "14" },
    { id: "20", label: "20" },
    { id: "24", label: "24" },
  ],
  correctOption: { known: "14" },
  notes:
    "Question, options and answer supplied by Humza, 20 November 2026; wording preserved. Pairs with humza-body-count-bodies (the BODY count).",
});
