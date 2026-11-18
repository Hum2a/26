import { choiceQuestion } from "../../authoring.ts";

export const colour = choiceQuestion({
  id: "colour",
  title: "Night sky",
  status: "ready",
  prompt: "Illustrative demo: which colour is the night sky in this drawing?",
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/colour/photo.jpg",
      credit: "Original demo illustration · CC0",
      alt: "A drawing of a night sky",
    },
  ],
  options: [
    { id: "blue", label: "Blue" },
    { id: "green", label: "Green" },
    { id: "orange", label: "Orange" },
  ],
  correctOption: { known: "blue" },
  points: 80,
  collectMs: 15_000,
  speedBonus: null,
  modifiers: ["double"],
  attribution: "never",
});
