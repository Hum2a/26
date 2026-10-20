import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItFreedom = choiceQuestion({
  id: "who-said-it-freedom",
  title: "Who said it: the ignorant masses",
  presentation: "who-said-it",
  prompt: "It seems the ignorant masses are doomed to remain as such...",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Masayoshi Shido (Persona 5 Royal)",
    },
    {
      id: "b",
      label: "Peter Thiel (founder essay)",
    },
  ],
  correctOption: {
    known: "a",
  },
  explanation:
    "Shadow Shido, Persona 5 Royal. Apparently the electorate failed his performance review.",
  notes:
    "Verified replacement for an unverified supplied passage. Original game asset e424_002.bmd, MSG_004_0_0, speaker Shadow Shido. First sentence only; game-data mirror, not publisher-hosted. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
