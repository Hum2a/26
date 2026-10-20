import { sliderQuestion } from "../../authoring.ts";

// Numeric-entry/scoring concept only; no reference price or input bounds are invented.
export const guessTabEvCharge = sliderQuestion({
  id: "guess-tab-ev-charge",
  title: "Guess the Tab: EV full charge",
  prompt:
    "Cost to charge a 62 kWh battery from 0 to 100% on standard UK domestic peak electricity.",
  instructions: "Guess the price. Closest without going over wins.",
  unit: "p",
  truth: {
    missing: {
      code: "truth",
      name: "reference-price",
      detail:
        "A dated domestic tariff/unit rate, location and whether 62 kWh is billed energy or battery energy with specified charging losses. Do not include standing charges without agreement.",
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
