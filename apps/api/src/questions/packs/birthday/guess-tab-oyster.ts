import { sliderQuestion } from "../../authoring.ts";

// Numeric-entry/scoring concept only; no reference price or input bounds are invented.
export const guessTabOyster = sliderQuestion({
  id: "guess-tab-oyster",
  title: "Guess the Tab: TfL Oyster fare",
  prompt: "Peak tube fare from Sutton station to Oxford Circus via Zone 1.",
  instructions: "Guess the price. Closest without going over wins.",
  unit: "p",
  truth: {
    missing: {
      code: "truth",
      name: "reference-price",
      detail:
        "A dated adult Oyster/contactless peak single fare for a specified National Rail/Tube route and payment basis. Sutton station is not itself a Tube station.",
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
