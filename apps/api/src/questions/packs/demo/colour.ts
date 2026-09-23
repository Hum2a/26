import { choiceQuestion } from "../../authoring.ts";

export const colour = choiceQuestion({
  id: "colour",
  title: "Night sky",
  status: "ready",
  prompt: "Illustrative demo: which colour is the night sky in this drawing?",
  options: [
    { id: "blue", label: "Blue" },
    { id: "green", label: "Green" },
    { id: "orange", label: "Orange" },
  ],
  correctOption: { known: "blue" },
  points: 80,
  collectMs: 15_000,
  speedBonus: null,
  modifiers: ["double"],
  attribution: "never",
});
