import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItEmpathy = choiceQuestion({
  id: "who-said-it-empathy",
  title: "Who said it: empathy",
  presentation: "who-said-it",
  prompt:
    "Empathy is a luxury invented by the mediocre to slow down the extraordinary.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Madarame (Persona 5)" },
    {
      id: "b",
      label: 'A real viral LinkedIn post by a 22-year-old "B2B SaaS Growth Hacker"',
    },
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
    'Supplied answer: B. Supplied reveal: A genuine LinkedIn lunatic explaining why firing his cousin was "a masterclass in emotional ROI". Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.',
});
