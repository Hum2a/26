import { typedQuestion } from "../../authoring.ts";

// Design brief: a deed-poll certificate; the old name is stamped out at the reveal.
// Guests type the name. Case, accents, punctuation and a small typo are forgiven.
export const realNameZackPolanski = typedQuestion({
  id: "real-name-zack-polanski",
  presentation: "deed-poll",
  title: "Real name: Zack Polanski",
  prompt: "What was their real name? Zack Polanski",
  accepted: { known: ["David Paulden"] },
  explanation: "Zack Polanski was born David Paulden and changed his name at 18.",
});
