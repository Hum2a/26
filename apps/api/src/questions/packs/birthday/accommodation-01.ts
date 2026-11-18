import { choiceQuestion } from "../../authoring.ts";

export const accommodation01 = choiceQuestion({
  id: "accommodation-01",
  title: "Uni accommodation or prison: 01",
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
    known: "uni",
  },
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/accommodation-01/photo.jpg",
      creditUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      credit: "Aqwis · CC BY-SA 3.0",
      alt: "Exterior of a residential building",
    },
  ],
  explanation:
    "Fantoft Studentby in Bergen is university accommodation. The concrete blocks are student halls.",
  notes:
    "https://sammen.no/en/bolig/en-fantoft-studentboliger | Photo source and licence: https://commons.wikimedia.org/wiki/File:FantoftStudentVillage.jpg",
});
