import { sliderQuestion } from "../../authoring.ts";

// Numeric-entry/scoring concept only; no reference price or input bounds are invented.
export const guessTabSohoPint = sliderQuestion({
  id: "guess-tab-soho-pint",
  title: "Guess the Tab: London pint index",
  prompt: "Price of a standard pint of Camden Hells at a pub in Soho.",
  instructions: "Guess the price. Closest without going over wins.",
  unit: "p",
  truth: {
    missing: {
      code: "truth",
      name: "reference-price",
      detail:
        "A named Soho pub, dated menu/till price and standard draught pint; no invented London-wide retail price.",
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
