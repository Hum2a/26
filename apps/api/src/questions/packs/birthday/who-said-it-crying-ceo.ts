import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItCryingCeo = choiceQuestion({
  id: "who-said-it-crying-ceo",
  title: "Who said it: freedom and democracy",
  presentation: "who-said-it",
  prompt: "I no longer believe that freedom and democracy are compatible.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Masayoshi Shido (Persona 5 Royal)",
    },
    {
      id: "b",
      label: "Peter Thiel (The Education of a Libertarian)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "Peter Thiel, in his 2009 Cato Unbound essay. A real author, a real essay, and a sentence with final-boss energy.",
  notes:
    "Verified replacement for an unverified supplied passage. Original signed essay, 13 April 2009. Exact sentence excerpt begins after “Most importantly,”. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
