import { choiceQuestion } from "../../authoring.ts";

export const humzaBodyCountBodies = choiceQuestion({
  id: "humza-body-count-bodies",
  title: "Humza's BODY count",
  prompt: "What's Humza's BODY count?",
  instructions: "Pick one, then send.",
  options: [
    { id: "0", label: "0" },
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
  ],
  correctOption: { known: "1" },
  notes:
    "Question, options and answer supplied by Humza, 20 November 2026; wording preserved. The capitalised BODY is the joke: the follow-up to humza-body-count.",
});
