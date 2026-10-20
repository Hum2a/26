import { sliderQuestion } from "../../authoring.ts";

// Sources and comparison limitations: docs/content/inflation-price-sources.md.
export const inflationFreddo = sliderQuestion({
  id: "inflation-freddo",
  title: "Inflation: Freddo",
  prompt: "Freddo: guess the price in 2026",
  instructions:
    "A standard UK Freddo was typically 20p in 2012. What does a single 18g Dairy Milk Freddo cost at Tesco on 20 October 2026? Guess in pence.",
  minimum: 5,
  maximum: 100,
  step: 1,
  initial: 20,
  unit: "p",
  truth: { known: 35 },
  explanation:
    "35p at Tesco for a single 18g Dairy Milk Freddo, checked on 20 October 2026. That is 75% above the typical 20p historical baseline. Prices vary by shop; this is not a UK average or an official inflation index.",
  notes:
    "Show the 2012 price, then estimate 2026. Tesco lists the 18g single at 35p (checked 20 October 2026). The typical 20p 2012 baseline is inferred from StepChange's timeline: 20p in 2011, 25p in 2014; a 2011 petition open until September 2012 also cites 20p. This is a historical typical single-bar price versus a dated Tesco price, not identical retailer/pack-size records or a national average. Full sources: docs/content/inflation-price-sources.md.",
});
