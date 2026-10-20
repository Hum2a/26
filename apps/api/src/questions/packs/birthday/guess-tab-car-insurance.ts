import { sliderQuestion } from "../../authoring.ts";

// Numeric-entry/scoring concept only; no reference price or input bounds are invented.
export const guessTabCarInsurance = sliderQuestion({
  id: "guess-tab-car-insurance",
  title: "Guess the Tab: first car insurance",
  prompt: "Average annual insurance quote for a 25-year-old on their first UK policy.",
  instructions: "Guess the price. Closest without going over wins.",
  unit: "p",
  truth: {
    missing: {
      code: "truth",
      name: "reference-price",
      detail:
        "A defined source/date, vehicle, location, excess, cover level and new-policy cohort. Do not substitute a generic national driver average.",
    },
  },
  requirements: [
    {
      code: "truth",
      name: "price-is-right-scoring",
      detail:
        "Server-authoritative closest-without-going-over ranking, tie handling and the outcome when every guess exceeds the reference. Ordinary exact-value slider scoring is not this mechanic.",
    },
  ],
  notes:
    "Guess the Tab concept: all guests submit a numeric guess; closest without going over wins. Needs numeric-entry controls/bounds, real reference facts and the missing room-wide scoring. Slider is an authoring placeholder only, not a working substitute. No live ordering or release. See docs/content/party-concepts.md.",
});
