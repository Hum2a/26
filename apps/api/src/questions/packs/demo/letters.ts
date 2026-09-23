import { sliderQuestion } from "../../authoring.ts";

export const letters = sliderQuestion({
  id: "letters",
  title: "Birthday letters",
  status: "ready",
  prompt: "Illustrative demo: how many letters are in birthday?",
  minimum: 0,
  maximum: 20,
  step: 1,
  unit: "letters",
  initial: 10,
  truth: { known: 8 },
  points: 100,
  collectMs: 20_000,
  attribution: "after",
  bands: [
    { within: 0, points: 100 },
    { within: 2, points: 40 },
  ],
});
