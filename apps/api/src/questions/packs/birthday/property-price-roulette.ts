import { sliderQuestion } from "../../authoring.ts";

export const propertyPriceRoulette = sliderQuestion({
  id: "property-price-roulette",
  title: "Property price roulette: Rightmove horror show",
  prompt: "How much is this London “studio flat” per month?",
  instructions:
    "Enter a monthly rent in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 0,
  maximum: 4000,
  step: 1,
  initial: 0,
  unit: "£",
  truth: {
    known: 750,
  },
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/property-price-roulette/photo.jpg",
      credit: "Listing photograph · copyrighted, private use",
      alt: "Interior of a compact London studio advertised as a flat",
    },
  ],
  explanation:
    "£750 pcm. Winkworth listed this compact Lower Clapton studio as a long-term let. There is no kitchen; a microwave is supplied.",
  notes:
    "OnTheMarket 13835770, Winkworth, Saratoga Road E5. £750 pcm, deposit £865.40, no kitchen, microwave supplied. Floorplan (docs/content/listings/property-price-roulette/floorplan.jpg, not public) 79 sq ft. Extra stills: exterior.jpg, interior-a/b/c.jpg. Copyrighted listing photos, private use. Catalogue only until slotted.",
});
