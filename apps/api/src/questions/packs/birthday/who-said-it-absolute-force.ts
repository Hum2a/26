import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItAbsoluteForce = choiceQuestion({
  id: "who-said-it-absolute-force",
  title: "Who said it: salvation in ruin",
  presentation: "who-said-it",
  prompt: "The only hope of salvation lies in ruin!",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Shuji Ikutsuki (Persona 3 FES)",
    },
    {
      id: "b",
      label: "A venture capitalist discussing disruption",
    },
  ],
  correctOption: {
    known: "a",
  },
  explanation:
    "Shuji Ikutsuki, Persona 3 FES. The actual villain is doing the disruption pitch this time.",
  notes:
    "Verified replacement for an unverified supplied passage. Original game asset E290_001.PM1 @ 0x230, MSG_021, speaker Shuji Ikutsuki. Exact sentence excerpt; game-data mirror. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
