import { sliderQuestion } from "../../authoring.ts";

// UK government weekly average pump prices, including duty and VAT.
// Exact source values: 138.35p (15 October 2012), 175.28p (12 October 2026).
// Only the scoring target is rounded, explicitly requested in the instructions.
export const inflationPetrol = sliderQuestion({
  id: "inflation-petrol",
  title: "Inflation: petrol",
  prompt: "Petrol: guess the price in 2026",
  instructions:
    "UK unleaded petrol, pence per litre. On 15 October 2012 the UK average was 138.35p. Guess the UK average on 12 October 2026, rounded to the nearest penny.",
  minimum: 50,
  maximum: 300,
  step: 1,
  initial: 138,
  unit: "p/litre",
  truth: { known: 175 },
  explanation:
    "175p per litre to the nearest penny. The published UK average was 175.28p on 12 October 2026, versus 138.35p on 15 October 2012. These are dated weekly unleaded pump prices, including duty and VAT, not annual averages.",
  notes:
    "Show the 2012 price, then estimate 2026. DESNZ weekly road fuel tables: ULSP 138.35p/litre on 15 October 2012; 175.28p/litre on 12 October 2026. UK averages include duty and VAT. Use comparable mid-October weeks, not a partial-year 2026 annual average. The answer rounds to 175p so a one-penny slider can hit it. Sources: docs/content/inflation-price-sources.md.",
});
