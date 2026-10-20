import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItPerformanceReview = choiceQuestion({
  id: "who-said-it-performance-review",
  title: "Who said it: performance review",
  presentation: "who-said-it",
  prompt:
    "Pain is the only teacher. If an employee cries during a performance review, you haven't broken them—you've unlocked their next tier.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Suguru Kamoshida (Persona 5)" },
    { id: "b", label: "A London-based FinTech Founder on LinkedIn" },
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
    'Supplied answer: B. Supplied reveal: FinTech "Culture evangelist" post. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.',
});
