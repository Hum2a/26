import { sliderQuestion } from "../../authoring.ts";

// Reported historical prices, not a single nationwide tariff; see the source note.
export const inflationSausageRoll = sliderQuestion({
  id: "inflation-sausage-roll",
  title: "Inflation: Greggs sausage roll",
  prompt: "The Greggs gold standard: one sausage roll",
  instructions:
    "A Greggs sausage roll was reportedly 66p in 2012. Guess its price in most UK shops as reported on 8 January 2026, in pence. One roll, no drink. Slide to your estimate.",
  minimum: 50,
  maximum: 300,
  step: 1,
  initial: 66,
  unit: "p",
  truth: { known: 135 },
  explanation:
    "£1.35: the price LBC reported for most Greggs shops on 8 January 2026. A pastry with a stronger financial trajectory than your savings account. Shop prices vary; this is a dated reported price, not a national average or a promise about today’s till.",
  notes:
    "Historical 66p baseline: The Guardian, 19 September 2025. January 2026 £1.35 price in most shops: LBC, 8 January 2026 (updated 10 February). Greggs’s public product page does not quote one national price. Freeze this comparison to the reported January price; do not substitute London, motorway or delivery prices. Sources: docs/content/inflation-price-sources.md.",
});
