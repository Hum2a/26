import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItTechnology = choiceQuestion({
  id: "who-said-it-technology",
  title: "Who said it: industrial consequences",
  presentation: "who-said-it",
  prompt:
    "The Industrial Revolution and its consequences have been a disaster for the human race.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Yaldabaoth (Persona 5)",
    },
    {
      id: "b",
      label: "Ted Kaczynski (Industrial Society and Its Future)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "The opening of Kaczynski’s manifesto, published in 1995. This is the real-world source.",
  notes:
    "Verified replacement for an unverified supplied passage. Original document publication, opening sentence, 19 September 1995. Neutral source-identification question, no endorsement. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
