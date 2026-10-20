import { sliderQuestion } from "../../authoring.ts";

export const guessTabEvCharge = sliderQuestion({
  id: "guess-tab-ev-charge",
  title: "Guess the Tab: EV full charge",
  prompt:
    "Charge a 62 kWh battery from empty to full at the Jan–Mar 2026 GB average capped electricity rate. What is the energy cost?",
  instructions:
    "Enter a price in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 0,
  maximum: 100,
  step: 0.01,
  initial: 0,
  unit: "£",
  truth: {
    known: 17.17,
  },
  explanation:
    "£17.17. Ofgem’s Jan–Mar 2026 direct-debit average was 27.69p/kWh: 62 × £0.2769 = £17.1678, rounded to the penny. Charging losses and standing charges are excluded.",
  notes:
    "Frozen reference: Ofgem Jan–Mar 2026 direct-debit GB average including VAT, 27.69p/kWh. Ideal 62 kWh input, no charging losses or standing charge. Defined calculation, not a claim every household pays this rate. See docs/content/party-polish-sources.md.",
});
