import { typedQuestion } from "../../authoring.ts";

// Design brief: a council-count podium with a bin lid; the name is unmasked at the reveal.
// Guests type the name. Case, accents, punctuation and a small typo are forgiven.
export const realNameCountBinface = typedQuestion({
  id: "real-name-count-binface",
  presentation: "bin-unmasked",
  title: "Real name: Count Binface",
  prompt: "What was their real name? Count Binface",
  accepted: { known: ["Jon Harvey", "Jonathan Harvey"] },
  explanation: "Count Binface is the comedian Jon Harvey.",
});
