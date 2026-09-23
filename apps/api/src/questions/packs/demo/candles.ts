import { choiceQuestion } from "../../authoring.ts";

export const candles = choiceQuestion({
  id: "candles",
  title: "Candles",
  status: "ready",
  prompt: "Illustrative demo: how many candles are on this cake?",
  options: [
    { id: "sixteen", label: "16" },
    { id: "twenty-one", label: "21" },
    { id: "twenty-six", label: "26" },
    { id: "thirty", label: "30" },
  ],
  correctOption: { known: "twenty-six" },
  points: 120,
  collectMs: 30_000,
  speedBonus: { maxPoints: 40 },
  suppressSpeedBonus: true,
  attribution: "live",
});
