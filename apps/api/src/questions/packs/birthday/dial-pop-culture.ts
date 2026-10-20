import { sliderQuestion } from "../../authoring.ts";

export const dialPopCulture = sliderQuestion({
  id: "dial-pop-culture",
  title: "The Dial-In: pop culture snobbery",
  prompt: "Set the dial: Pop Culture Snobbery.",
  instructions:
    "0 = “Let people enjoy things” | 100 = “If it wasn't made before 2004, it is slop.”",
  minimum: 0,
  maximum: 100,
  step: 1,
  initial: 50,
  unit: "/100",
  truth: {
    missing: {
      code: "truth",
      name: "dial-target",
      detail:
        "Confirm self-placement versus predicting Humza/host, and supply a real target plus scoring rule if scored. No personal position has been supplied.",
    },
  },
  requirements: [
    {
      code: "truth",
      name: "subjective-slider-scoring",
      detail:
        "Define self-report poll, hidden target precision, or room consensus. Ordinary exact-price scoring must not be substituted for this subjective mechanic.",
    },
  ],
  notes:
    "Both spectrum endpoints are supplied jokes, not a factual claim about quality, geography or politics. The 50 starting value is only a neutral UI starting point, never a personal answer. The audience/target and scoring remain undecided. See docs/content/party-concepts.md.",
});
