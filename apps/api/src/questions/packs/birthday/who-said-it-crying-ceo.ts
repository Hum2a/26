import { choiceQuestion } from "../../authoring.ts";

export const whoSaidItCryingCeo = choiceQuestion({
  id: "who-said-it-crying-ceo",
  title: "Who said it: crying ceo",
  presentation: "who-said-it",
  prompt:
    "I laid off 15% of our staff this morning. Sitting at my desk crying made me realize: leadership isn't about numbers, it's about feeling the pain of others and still executing.",
  instructions: "Who said it? Pick A or B, then send.",
  options: [
    { id: "a", label: "Tohru Adachi (Persona 4)" },
    {
      id: "b",
      label: "A hyper-viral LinkedIn CEO post (with an accompanying crying selfie)",
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
    'Supplied answer: B. Supplied reveal: Braden Wallake, the infamous "Crying CEO" on LinkedIn. Unverified proposal: do not present as a genuine quotation or attribute it as fact. Source audit: docs/content/who-said-it-sources.md.',
});
