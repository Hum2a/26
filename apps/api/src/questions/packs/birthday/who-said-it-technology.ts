import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItTechnology = choiceQuestion({
  id: "who-said-it-technology",
  title: "Who said it: technology",
  presentation: "who-said-it",
  prompt:
    "Modern technology has completely alienated man from his natural instincts, turning the working populace into domestication livestock.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Yaldabaoth, God of Control (Persona 5)" },
    { id: "b", label: "The Unabomber (Industrial Society and Its Future)" },
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
    "Supplied answer: B. Supplied reveal: Ted Kaczynski. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
