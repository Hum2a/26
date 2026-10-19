import { sliderQuestion } from "../../authoring.ts";

export const inflationPetrol = sliderQuestion({
  id: "inflation-petrol",
  title: "Inflation: petrol",
  prompt: "Petrol: guess the price in 2026",
  notes:
    "Confirmed format: show the 2012 price, then guests estimate the 2026 price with a slider. Add the real 2012 reference price to the displayed instructions once supplied. Do not invent prices or slider bounds.",
  requirements: [
    {
      code: "prompt",
      name: "comparison",
      detail:
        "petrol grade, location, price units and comparison dates for the confirmed 2012-to-2026 comparison.",
    },
    {
      code: "truth",
      name: "reference-price",
      detail:
        "the supplied or sourced 2012 reference price for the specified fuel/location, to show in the question instructions.",
    },
  ],
  truth: {
    missing: {
      code: "truth",
      name: "target-price",
      detail:
        "the supplied or sourced 2026 target price for the specified fuel and location.",
    },
  },
});
