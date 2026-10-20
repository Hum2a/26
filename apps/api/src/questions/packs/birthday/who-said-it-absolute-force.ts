import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItAbsoluteForce = choiceQuestion({
  id: "who-said-it-absolute-force",
  title: "Who said it: absolute force",
  presentation: "who-said-it",
  prompt:
    "A person’s true worth is only proven when all social constructs are stripped away and they stand naked before absolute force.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Akechi Goro (Persona 5)" },
    { id: "b", label: "Anders Breivik (Far-right extremist manifesto)" },
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
    "Supplied answer: A. Supplied reveal: Goro Akechi during his boss fight rant. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
