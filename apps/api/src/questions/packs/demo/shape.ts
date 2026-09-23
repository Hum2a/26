import { choiceQuestion } from "../../authoring.ts";

export const shape = choiceQuestion({
  id: "shape",
  title: "Circle",
  status: "ready",
  prompt: "Illustrative demo: which of these is a circle?",
  options: [
    { id: "square", label: "Square" },
    { id: "circle", label: "Circle" },
    { id: "triangle", label: "Triangle" },
    { id: "star", label: "Star" },
  ],
  correctOption: { known: "circle" },
  points: 100,
  collectMs: 20_000,
  speedBonus: { maxPoints: 50 },
  attribution: "after",
});
