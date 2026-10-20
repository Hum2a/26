import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItEmpathy = choiceQuestion({
  id: "who-said-it-empathy",
  title: "Who said it: alchemy",
  presentation: "who-said-it",
  prompt:
    "We believe Artificial Intelligence is our alchemy, our Philosopher’s Stone – we are literally making sand think.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Yaldabaoth (Persona 5)",
    },
    {
      id: "b",
      label: "Marc Andreessen (The Techno-Optimist Manifesto)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "Marc Andreessen, in his 2023 Techno-Optimist Manifesto. This one came from venture capital, not a final boss.",
  notes:
    "Verified replacement for an unverified supplied passage. Intelligence section, 16 October 2023. Original essay on author’s firm site. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
