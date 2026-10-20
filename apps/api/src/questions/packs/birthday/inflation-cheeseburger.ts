import { sliderQuestion } from "../../authoring.ts";

// 2026 is explicitly an independent menu-guide quote, not an official UK tariff.
export const inflationCheeseburger = sliderQuestion({
  id: "inflation-cheeseburger",
  title: "Inflation: Maccies cheeseburger",
  prompt: "The 99p nostalgia tax: a Maccies cheeseburger",
  instructions:
    "A UK McDonald’s cheeseburger was 99p in 2012. Guess the September 2026 menu-guide price for one single cheeseburger, in pence. Not a meal; restaurant prices vary. Slide to your estimate.",
  minimum: 50,
  maximum: 350,
  step: 1,
  initial: 99,
  unit: "p",
  truth: { known: 139 },
  explanation:
    "£1.39 in the independent McDonald’s Menu Prices UK guide for September 2026. The 99p era has left the group chat. This is a guide’s listed single-burger price, not a verified quote for every restaurant; local and delivery prices can differ.",
  notes:
    "99p baseline inferred from McDonald’s own 28 July 2022 announcement: its first cheeseburger rise in over 14 years. September 2026 £1.39: independent fan guide mcdonalds-menu-prices.co.uk/mcdonalds-cheeseburger-price-uk/. McDonald’s listed £1.39 in its 2024 £5 deal release, but that is only corroboration, not a 2026 quote. No national-average claim. Sources: docs/content/inflation-price-sources.md.",
});
