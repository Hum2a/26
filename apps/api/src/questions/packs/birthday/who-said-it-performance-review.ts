import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItPerformanceReview = choiceQuestion({
  id: "who-said-it-performance-review",
  title: "Who said it: bend the world",
  presentation: "who-said-it",
  prompt:
    "A big secret is that you can bend the world to your will a surprising percentage of the time",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Goro Akechi (Persona 5 Royal)",
    },
    {
      id: "b",
      label: "Sam Altman (How To Be Successful)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "Sam Altman’s How To Be Successful. The world-bending monologue came from a founder’s blog.",
  notes:
    "Verified replacement for an unverified supplied passage. Section 9, “Be willful”. Exact opening clause; excerpt stops before the dash. Original authored blog post. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
