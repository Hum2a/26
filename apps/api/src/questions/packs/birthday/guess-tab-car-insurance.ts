import { sliderQuestion } from "../../authoring.ts";

export const guessTabCarInsurance = sliderQuestion({
  id: "guess-tab-car-insurance",
  title: "Guess the Tab: first car insurance",
  prompt:
    "Newly qualified and aged 25+: what was the median annual car insurance price paid through Go.Compare in June 2026?",
  instructions:
    "Enter a price in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 0,
  maximum: 5000,
  step: 0.01,
  initial: 0,
  unit: "£",
  truth: {
    known: 1002,
  },
  explanation:
    "£1,002. That is Go.Compare’s median annual premium for newly qualified drivers aged 25+, across cover types. It is a measured cohort, not a quote guaranteed to any one driver.",
  notes:
    "Material clarification: a precise first-policy average for exactly age 25 was not available. Prompt now names Go.Compare’s actual 25+ newly qualified cohort: full UK licence held <1 year, annual payment, all cover types, sales 1–30 June 2026. Primary /car-insurance/ table and footnote 7, checked 20 Oct 2026.",
});
