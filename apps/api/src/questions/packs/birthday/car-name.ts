import { choiceQuestion } from "../../authoring.ts";

// Design brief: a number plate or a dashboard. Each name is a plate, and the
// reveal fits the right one to the car.
export const carName = choiceQuestion({
  id: "car-name",
  presentation: "number-plate",
  title: "My car's name",
  prompt: "What do I call my car?",
  options: [
    { id: "hagakure", label: "Hagakure" },
    { id: "mr-brother", label: "Mr Brother" },
    { id: "the-leaf", label: "The Leaf" },
    { id: "sky", label: "Sky" },
  ],
  correctOption: { known: "hagakure" },
});
