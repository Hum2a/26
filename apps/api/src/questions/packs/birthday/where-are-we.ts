import { mapGuessQuestion } from "../../authoring.ts";

export const whereAreWe = mapGuessQuestion({
  id: "where-are-we",
  title: "Where are we?",
  prompt: "Where are we?",
  instructions: "Look for clues, then drop a pin and send it.",
  presentation: "where-are-we",
  // TODO owner: credited clue photo as required `question` media (neutral filename,
  // GPS stripped, credit that does not name the place). Do not invent the location.
  target: {
    missing: {
      code: "correct-answer",
      name: "location",
      detail: "Supply the place name and exact coordinates for the clue photo.",
    },
  },
  notes:
    "TODO owner: add the real clue photo and target.known { lat, lng, label }. Optional reveal explanation for Baseer. The phone/stage layout is presentation where-are-we. Stay a draft until those fields exist. Do not invent the place.",
});
