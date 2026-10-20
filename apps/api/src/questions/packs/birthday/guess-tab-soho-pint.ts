import { sliderQuestion } from "../../authoring.ts";

export const guessTabSohoPint = sliderQuestion({
  id: "guess-tab-soho-pint",
  title: "Guess the Tab: London pint index",
  prompt:
    "What does a standard pint of Camden Hells cost at The Roxy, Soho? Menu checked October 2026.",
  instructions:
    "Enter a price in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 0,
  maximum: 20,
  step: 0.01,
  initial: 0,
  unit: "£",
  truth: {
    known: 7.3,
  },
  explanation:
    "£7.30 for a standard pint on The Roxy’s menu. The cheaper happy-hour deal is a different offer. Your bank balance is not the only thing going flat.",
  notes:
    "Primary venue menu: https://www.theroxy.co.uk/food-and-drink, checked 20 Oct 2026. Camden Hells Pint £7.30, half £5.10; happy-hour Camden pints £4.80 excluded. Named Soho bar replaces an undefined pub-wide average; freezes this menu reference.",
});
