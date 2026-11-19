import { mapGuessQuestion } from "../../authoring.ts";

export const whereAreWe = mapGuessQuestion({
  id: "where-are-we",
  title: "Where are we?",
  prompt: "Where are we?",
  instructions: "Look for clues, then drop a pin and send it.",
  presentation: "where-are-we",
  target: {
    known: {
      // OpenStreetMap relation 5393745 (Corniche Tawada), centroid.
      lat: 30.4083,
      lng: -9.60199,
      label: "Agadir seafront, Morocco",
    },
  },
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/where-are-we/photo.webp",
      creditUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      credit: "Elmschrat · CC BY-SA 3.0 · via Wikimedia Commons",
      alt: "A brick seafront promenade beside a sandy beach, palms and people in the sun",
    },
  ],
  explanation:
    "Agadir’s Atlantic promenade. The city was rebuilt after the 1960 earthquake; the beach and corniche run for about 10 km.",
  notes:
    "Target: OSM relation 5393745 Corniche Tawada (pedestrian seafront), centroid 30.4082969° N, 9.6019883° W. Beach: OSM way 386830407 Plage d'Agadir. Photo: https://commons.wikimedia.org/wiki/File:01-beach-agadir-morocco.JPG (Elmschrat, CC BY-SA 3.0); resized to 1200 × 900 WebP, EXIF stripped. Credit and alt do not name the place.",
});
