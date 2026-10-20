import { sliderQuestion } from "../../authoring.ts";

// Dated sources and loyalty-price distinction: docs/content/inflation-price-sources.md.
export const inflationMealDeal = sliderQuestion({
  id: "inflation-meal-deal",
  title: "Inflation: Tesco meal deal",
  prompt: "The student tasting menu: a Tesco meal deal",
  instructions:
    "Main, snack, drink: £3 in 2012. Guess Tesco’s standard meal deal price WITH a Clubcard on 20 October 2026, in pence. No premium upgrade. Slide to your estimate.",
  minimum: 200,
  maximum: 800,
  step: 1,
  initial: 300,
  unit: "p",
  truth: { known: 385 },
  explanation:
    "£3.85 with a Clubcard, checked on 20 October 2026. Without one it is £4.25. Your three-course lunch still comes in a carrier bag. This compares the standard deal, not the premium version or an identical basket of products.",
  notes:
    "2012 £3 baseline: MoneySavingExpert, 21 October 2022, reporting Tesco’s statement that the price had held since 2012. 2026: Tesco’s own £3.85 Clubcard / £4.25 regular standard-deal offer, valid 12 October 2026–9 May 2027, checked 20 October. Clubcard pricing is explicit; the scheme and eligible range have changed. Sources: docs/content/inflation-price-sources.md.",
});
