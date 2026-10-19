import { wordleQuestion } from "../../authoring.ts";

export const completeAWordle = wordleQuestion({
  id: "complete-a-wordle",
  title: "Complete a Wordle",
  presentation: "glyph",
  prompt: "Complete a wordle",
  instructions: "Find the five-letter word in six guesses. You have two minutes.",
  answer: { known: "VULGY" },
  notes:
    "The supplied birthday word is explicitly allowed even outside the dictionary. Six guesses, two minutes, 100 points for solving; no speed bonus. Based on Encore Glyph's classic board and duplicate-letter marking; see docs/licenses/encore-glyph.md.",
});
