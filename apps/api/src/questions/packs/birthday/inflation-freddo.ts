import { sliderQuestion } from "../../authoring.ts";

export const inflationFreddo = sliderQuestion({
  id: "inflation-freddo",
  title: "Inflation: Freddo",
  prompt: "Freddo: guess the price in 2026",
  notes:
    "Confirmed format: show the 2012 price, then guests estimate the 2026 price with a slider. Add the real 2012 reference price to the displayed instructions once supplied. Do not invent prices or slider bounds.",
  requirements: [
    {
      code: "prompt",
      name: "comparison",
      detail:
        "Freddo size, location and price units for the confirmed 2012-to-2026 comparison.",
    },
    {
      code: "truth",
      name: "reference-price",
      detail:
        "the supplied or sourced 2012 reference price and date for this exact product, to show in the question instructions.",
    },
  ],
  truth: {
    missing: {
      code: "truth",
      name: "target-price",
      detail:
        "the supplied or sourced 2026 target price and date for this exact product.",
    },
  },
});
