import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItNihilism = choiceQuestion({
  id: "who-said-it-nihilism",
  title: "Who said it: like a plague",
  presentation: "who-said-it",
  prompt:
    "I thought I could just leave you be, but you're like a plague... I'll have to get rid of all of you!",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Tohru Adachi (Persona 4)",
    },
    {
      id: "b",
      label: "A CEO explaining a restructure",
    },
  ],
  correctOption: {
    known: "a",
  },
  explanation:
    "Adachi, Persona 4. An actual boss fight, mercifully without an all-hands calendar invite.",
  notes:
    "Verified replacement for an unverified supplied passage. Original game battle script e209.bf, MSG_BTLSTART_002, speaker Adachi. Game-data mirror. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
