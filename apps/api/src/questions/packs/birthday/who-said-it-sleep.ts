import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItSleep = choiceQuestion({
  id: "who-said-it-sleep",
  title: "Who said it: Day 2",
  presentation: "who-said-it",
  prompt:
    "Day 2 is stasis. Followed by irrelevance. Followed by excruciating, painful decline. Followed by death.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    {
      id: "a",
      label: "Takuto Maruki (Persona 5 Royal)",
    },
    {
      id: "b",
      label: "Jeff Bezos (Amazon shareholder letter)",
    },
  ],
  correctOption: {
    known: "b",
  },
  explanation:
    "Jeff Bezos, in his 2016 shareholder letter. The final boss was a quarterly business review.",
  notes:
    "Verified replacement for an unverified supplied passage. Opening answer to “what does Day 2 look like?”. Original shareholder letter hosted by Amazon; excerpt ends before the next sentence. Full source and original-proposal history: docs/content/who-said-it-sources.md.",
});
