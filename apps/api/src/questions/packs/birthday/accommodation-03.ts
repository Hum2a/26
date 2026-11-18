import { choiceQuestion } from "../../authoring.ts";

export const accommodation03 = choiceQuestion({
  id: "accommodation-03",
  title: "Uni accommodation or prison: 03",
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
      asset: "/assets/questions/accommodation-03/photo.jpg",
      creditUrl: "https://creativecommons.org/licenses/by/4.0",
      credit: "Julian Herzog (Website) · CC BY 4.0",
      alt: "Circular courtyard of a residential building",
    },
  ],
  explanation:
    "Tietgenkollegiet in Copenhagen is a student residence. The circular courtyard belongs to a dormitory.",
  notes:
    "https://tietgenkollegiet.dk/en/the-dorm/ | Photo source and licence: https://commons.wikimedia.org/wiki/File:Tietgenkollegiet_Student_Residence_Copenhagen_%C3%98restad_2014_01.jpg",
});
