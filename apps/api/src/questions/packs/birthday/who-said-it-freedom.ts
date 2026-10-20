import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItFreedom = choiceQuestion({
  id: "who-said-it-freedom",
  title: "Who said it: freedom",
  presentation: "who-said-it",
  prompt:
    "The masses do not want freedom; they want the illusion of safety. They yearn to be ruled by a will stronger than their own.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Masayoshi Shido (Persona 5)" },
    { id: "b", label: "Ted Kaczynski (The Unabomber Manifesto)" },
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
    "Supplied answer: A. Supplied reveal: Persona 5. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
