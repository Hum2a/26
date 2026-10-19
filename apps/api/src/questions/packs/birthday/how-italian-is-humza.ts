import { choiceQuestion } from "../../authoring.ts";

export const howItalianIsHumza = choiceQuestion({
  id: "how-italian-is-humza",
  title: "How Italian is Humza?",
  prompt: "Guess how Italian humza is",
  options: [
    { id: "one-percent", label: "1%" },
    { id: "pineapple", label: "pineapple belongs on pizza" },
    { id: "dominos", label: "dominos pizza is better than rome pizza" },
    { id: "half-percent", label: "0.5%" },
  ],
  correctOption: { known: "half-percent" },
});
