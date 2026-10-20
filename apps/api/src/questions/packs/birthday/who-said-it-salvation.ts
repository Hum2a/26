import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItSalvation = choiceQuestion({
  id: "who-said-it-salvation",
  title: "Who said it: salvation",
  presentation: "who-said-it",
  prompt:
    "Why do people cling to life when it only brings pain? True salvation is non-existence.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Nyx Avatar (Persona 3)" },
    { id: "b", label: "Varg Vikernes (Burzum / Black metal church burner)" },
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
    "Supplied answer: A. Supplied reveal: Persona 3. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
