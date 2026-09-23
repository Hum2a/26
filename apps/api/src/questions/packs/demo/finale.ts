import { finaleQuestion } from "../../authoring.ts";

/** Amina and Bilal are fixture names so this round can score. They are not guests. */
export const finale = finaleQuestion({
  id: "finale",
  title: "Final duel",
  status: "ready",
  prompt: "Illustrative demo: the final duel.",
  points: 70,
  collectMs: 20_000,
  predictMs: 20_000,
  attribution: "after",
  minimum: 0,
  maximum: 50,
  step: 1,
  target: 26,
  within: 2,
  tieBreak: "tied",
  contestants: { known: ["Amina", "Bilal"] },
  predictionPoints: 30,
});
