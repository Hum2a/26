import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItGriefPipeline = choiceQuestion({
  id: "who-said-it-grief-pipeline",
  title: "Who said it: extraordinary effort",
  presentation: "who-said-it",
  prompt:
    "It's not enough just to do something extraordinary initially. You have to make an extraordinary effort initially.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Kunikazu Okumura (Persona 5)",
    },
    {
      id: "b",
      label: "Paul Graham (Do Things that Don’t Scale)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "Paul Graham, Do Things that Don’t Scale. Before recruiting party members, apparently you must recruit users manually.",
  notes:
    "Verified replacement for an unverified supplied passage. Original founder essay, closing Vector section. Two exact sentences; 2013. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
