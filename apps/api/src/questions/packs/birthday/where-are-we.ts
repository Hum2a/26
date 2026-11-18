import { mapGuessQuestion } from "../../authoring.ts";

export const whereAreWe = mapGuessQuestion({
  id: "where-are-we",
  title: "Where are we?",
  prompt: "Where are we?",
  instructions: "Look for clues, then drop a pin and send it.",
  target: {
    missing: {
      code: "correct-answer",
      name: "location",
      detail: "Supply the place name and exact coordinates for the clue photo.",
    },
  },
});
