import { sliderQuestion } from "../../authoring.ts";

export const propertyPriceRoulette = sliderQuestion({
  id: "property-price-roulette",
  title: "Property price roulette: Rightmove horror show",
  prompt: "How much is this London “studio flat” per month?",
  instructions:
    "Look at the listing on the stage. Slide to your monthly rent estimate in pounds.",
  media: [
    {
      name: "listing-photo",
      kind: "image",
      required: true,
    },
  ],
  requirements: [
    {
      code: "truth",
      name: "property-listing",
      detail:
        "Supply a dated listing, its monthly rent, an authorised image and the actual estate-agent wording for the reveal.",
    },
  ],
  notes:
    "No real listing or rent supplied. Do not treat the example “Charming, compact studio…” copy as an authentic estate-agent quotation. Keep image, price, range and reveal missing rather than inventing evidence.",
});
