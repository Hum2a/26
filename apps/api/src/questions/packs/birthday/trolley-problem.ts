import { choiceQuestion } from "../../authoring.ts";

// Design brief: a railway junction with a lever. Phones pull or leave the
// lever; the stage shows the track splitting as the votes come in.
// An unscored poll: the reveal shows the room's split.
export const trolleyProblem = choiceQuestion({
  id: "trolley-problem",
  presentation: "trolley-lever",
  title: "Trolley problem",
  prompt: "A train is heading for 5 people. You can derail it to kill only 1. Do you?",
  outcome: { kind: "poll" },
  options: [
    { id: "derail", label: "Yes, derail it" },
    { id: "leave", label: "No, leave it" },
  ],
});
