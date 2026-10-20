import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItSalvation = choiceQuestion({
  id: "who-said-it-salvation",
  title: "Who said it: a stepping stone",
  presentation: "who-said-it",
  prompt: "Do not fear. This life is but a stepping stone. Salvation shall be yours...",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Takaya (Persona 3 FES)",
    },
    {
      id: "b",
      label: "A founder writing about career progression",
    },
  ],
  correctOption: {
    known: "a",
  },
  explanation:
    "Takaya, Persona 3 FES. This is cult-leader dialogue from the game, not a promotion framework.",
  notes:
    "Verified replacement for an unverified supplied passage. Original game asset E271_001.PM1 @ 0x170, MSG_013, speaker Takaya. Game-data mirror. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
