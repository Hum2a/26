import { choiceQuestion } from "../../authoring.ts";

export const humzaDeportation = choiceQuestion({
  id: "humza-deportation",
  title: "Deported because of Humza",
  prompt: "What country did one of Humza's get deported to BECAUSE OF HIM?",
  instructions: "Pick one, then send.",
  options: [
    { id: "north-korea", label: "North Korea" },
    { id: "saudi-arabia", label: "Saudi Arabia" },
    { id: "yugoslavia", label: "Yugoslavia" },
    { id: "ussr", label: "USSR" },
    { id: "iran", label: "Iran" },
  ],
  correctOption: { known: "saudi-arabia" },
  notes:
    "Question, options and answer supplied by Humza, 20 November 2026; wording preserved.",
});
