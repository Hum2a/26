import { choiceQuestion } from "../../authoring.ts";

export const accommodation02 = choiceQuestion({
  id: "accommodation-02",
  title: "Uni accommodation or prison: 02",
  prompt: "Uni accommodation or prison?",
  instructions: "Inspect the photo. Pick one, then send.",
  options: [
    {
      id: "uni",
      label: "Uni accommodation",
    },
    {
      id: "prison",
      label: "Prison",
    },
  ],
  correctOption: {
    known: "prison",
  },
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/accommodation-02/photo.jpg",
      creditUrl: "https://creativecommons.org/licenses/by/2.0",
      credit: "Justis- og politidepartementet · CC BY 2.0",
      alt: "Bright interior corridor of a residential building",
    },
  ],
  explanation:
    "This is an interior at Halden Prison in Norway. The bright corridor is part of the prison.",
  notes:
    "https://commons.wikimedia.org/wiki/File:Interior_in_Halden_prison.jpg | Photo source and licence: https://commons.wikimedia.org/wiki/File:Interior_in_Halden_prison.jpg",
});
