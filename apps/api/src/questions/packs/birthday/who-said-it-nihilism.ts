import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItNihilism = choiceQuestion({
  id: "who-said-it-nihilism",
  title: "Who said it: nihilism",
  presentation: "who-said-it",
  prompt:
    "The world is full of shit. It’s boring, and everyone’s just pretending. People who try hard are just idiots who haven’t figured out the joke yet.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Tohru Adachi (Persona 4)" },
    { id: "b", label: "Elliot Rodger (The Isla Vista manifesto)" },
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
    "Supplied answer: A. Supplied reveal: Adachi's pure nihilist rant in P4. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.",
});
