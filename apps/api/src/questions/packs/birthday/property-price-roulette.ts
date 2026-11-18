import { sliderQuestion } from "../../authoring.ts";

export const propertyPriceRoulette = sliderQuestion({
  id: "property-price-roulette",
  title: "Property price roulette: Rightmove horror show",
  prompt:
    "How much is this London “studio flat” per month? Winkworth listing, February 2026.",
  instructions:
    "Enter a monthly rent in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 250,
  maximum: 3000,
  step: 10,
  initial: 250,
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
      credit: "© Winkworth / OnTheMarket · copyrighted, private use",
      alt: "Interior of a compact London studio advertised as a flat",
    },
  ],
  explanation:
    "£750 pcm (Evening Standard, 11 February 2026). Winkworth: a “charming studio flat”, “perfect pied de terre or low key accomodation. There is no kitchen in the property but a microwave is supplied.” 79 sq ft.",
  notes:
    "Winkworth / OnTheMarket 13835770, Evening Standard 11 Feb 2026. Saratoga Road, Lower Clapton, E5. £750 pcm. Floorplan and extra stills (exterior, interior-a/b/c) live under docs/content/listings/property-price-roulette/, not /assets. Public clue is the interior only. © Winkworth / OnTheMarket, copyrighted, private use. Catalogue only.",
});
