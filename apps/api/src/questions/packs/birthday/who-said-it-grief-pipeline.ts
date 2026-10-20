import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItGriefPipeline = choiceQuestion({
  id: "who-said-it-grief-pipeline",
  title: "Who said it: grief pipeline",
  presentation: "who-said-it",
  prompt:
    "My grandmother passed away at 4:18 AM. By 6:00 AM, I closed an Enterprise contract. Grief is temporary; pipeline momentum is permanent. Here’s what death taught me about sales:",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Kunikazu Okumura (Persona 5)" },
    { id: "b", label: "An actual LinkedIn post" },
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
    "Supplied answer: B. Supplied reveal: Tragically real r/LinkedInLunatics Hall of Fame post. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
