import { choiceQuestion } from "../../authoring.ts";

// Design brief: two pills in two open hands, red and blue, on a dark ground.
// The stage hides the split until the reveal, then shows who lived.
// Scored by the room: if more than half pick blue, everyone who answered
// scores. Otherwise only the red pills score.
export const redPillBluePill = choiceQuestion({
  id: "red-pill-blue-pill",
  presentation: "red-blue-pill",
  title: "Red pill, blue pill",
  prompt:
    "Everyone in the world has to take a blue pill or a red pill. If more than 50% pick blue, everyone lives. If not, red pills live and blue pills die.",
  options: [
    { id: "red", label: "Red pill" },
    { id: "blue", label: "Blue pill" },
  ],
  outcome: {
    kind: "threshold",
    optionId: "blue",
    above: 0.5,
    met: "everyone",
    otherwise: ["red"],
  },
});
