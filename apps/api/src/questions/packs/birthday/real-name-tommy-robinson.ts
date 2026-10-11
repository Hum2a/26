import { typedQuestion } from "../../authoring.ts";

// Design brief: a redacted file; the black bar lifts off the name at the reveal.
// Guests type the name. Case, accents, punctuation and a small typo are forgiven.
export const realNameTommyRobinson = typedQuestion({
  id: "real-name-tommy-robinson",
  presentation: "redacted-file",
  title: "Real name: Tommy Robinson",
  prompt: "What was their real name? Tommy Robinson",
  accepted: { known: ["Stephen Yaxley-Lennon", "Stephen Lennon", "Stephen Yaxley"] },
  explanation: "Tommy Robinson's real name is Stephen Yaxley-Lennon.",
});
