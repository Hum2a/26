import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItSleep = choiceQuestion({
  id: "who-said-it-sleep",
  title: "Who said it: sleep",
  presentation: "who-said-it",
  prompt:
    "Sleep is a biological tax imposed on humanity by weakness. If you are sleeping 8 hours, you are conceding a third of your destiny to competitors.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Takuto Maruki (Persona 5 Royal)" },
    { id: "b", label: 'A self-described "Crypto Hedge Fund Patriarch" on X/LinkedIn' },
  ],
  correctOption: {
    missing: {
      code: "correct-answer",
      name: "verified-attribution",
      detail:
        "A verified source for this exact wording and its speaker; the supplied answer is a proposal only.",
    },
  },
  requirements: [
    {
      code: "truth",
      name: "quote-source",
      detail:
        "A primary source, exact game dialogue reference or clearly authorised parody framing. The supplied quote and attribution are unverified.",
    },
  ],
  notes:
    "Supplied answer: B. Supplied reveal: Real tech-bro grind post. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
