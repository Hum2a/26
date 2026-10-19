import { choiceQuestion } from "../../authoring.ts";

export const christianityBranches = choiceQuestion({
  id: "christianity-branches",
  title: "Branches of Christianity",
  prompt: "Which of these ARE branches of Christianity?",
  instructions: "Select all that apply.",
  notes:
    "Confirmed answers: muggletonians, the jumpers, ranters. Humza confirmed changing NOT to ARE and allowing all three selections. Keep this draft until multiple-selection answers and set scoring are supported; never substitute one correct option or a poll.",
  requirements: [
    {
      code: "options",
      name: "multiple-selection",
      detail:
        "a server-authoritative multiple-selection mechanic and answer-set scoring for the three confirmed answers.",
    },
  ],
  options: [
    { id: "unorthodox", label: "unorthodox" },
    { id: "jisraeli", label: "jisraeli" },
    { id: "irish-terrorists", label: "Irish Catholic terrorists" },
    { id: "muggletonians", label: "muggletonians" },
    { id: "the-jumpers", label: "the jumpers" },
    { id: "ranters", label: "ranters" },
  ],
  correctOption: {
    missing: {
      code: "correct-answer",
      name: "multiple-answer-set",
      detail:
        "representation of the confirmed answer set [muggletonians, the-jumpers, ranters]; the single-correct-option field cannot encode it.",
    },
  },
});
