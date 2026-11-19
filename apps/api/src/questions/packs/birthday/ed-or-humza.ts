import { rankQuestion } from "../../authoring.ts";

export type QuoteSpeaker = "ed" | "humza";
export type EdOrHumzaQuote = {
  id: string;
  quote: string;
  speaker: QuoteSpeaker | null;
};

/** Set speaker to "ed" or "humza" when confirmed. Append quotes with new stable ids. */
export const edOrHumzaQuotes: readonly EdOrHumzaQuote[] = [
  {
    id: "quote-01",
    quote: "I'd baptise a baby with a water pressure jet just to make the local news",
    speaker: null,
  },
  { id: "quote-02", quote: "I sense Israel in your general direction", speaker: null },
  { id: "quote-03", quote: "You're ass is in grabbing distance", speaker: null },
  {
    id: "quote-04",
    quote: "You're talking a lot of shit for a washing machine",
    speaker: null,
  },
  {
    id: "quote-05",
    quote: "Sometimes bad men have to do bad things to teach women a lesson",
    speaker: null,
  },
  {
    id: "quote-06",
    quote:
      "If jensan can bang all those baddies with a 1 incher imagine what I can do with a 9mm",
    speaker: null,
  },
  { id: "quote-07", quote: "Biblically accurate breasts on that one", speaker: null },
  {
    id: "quote-08",
    quote: "Internally I feel external and externally I feel internal",
    speaker: null,
  },
  { id: "quote-09", quote: "A creampie. His cum in your vagina.", speaker: null },
  { id: "quote-10", quote: "No exchange of bodily fluids occurred", speaker: null },
  {
    id: "quote-11",
    quote:
      "(In response to how was your Christmas) It was good. Busted one out in your memory",
    speaker: null,
  },
  {
    id: "quote-12",
    quote:
      "You know Belinda asked me if I wanted to get a fleshlight and I said only if it came inside a doll of the main character from zootopia",
    speaker: null,
  },
  {
    id: "quote-13",
    quote: "I’ve decided that I’m going to bust to the thought of you tonight",
    speaker: null,
  },
  { id: "quote-14", quote: "The classic - I’m going to touch you", speaker: null },
  { id: "quote-15", quote: "you're tits are looking great today", speaker: null },
  { id: "quote-16", quote: "You would've been worth the jail time", speaker: null },
  {
    id: "quote-17",
    quote: "If they don't want a dick they can give the inches to me",
    speaker: null,
  },
  {
    id: "quote-18",
    quote: "Smaller but firm can outperform larger but drippy",
    speaker: null,
  },
];

/** Answer-key configuration stays server-side; previews receive only quote text and names. */
export function makeEdOrHumza(quotes: readonly EdOrHumzaQuote[] = edOrHumzaQuotes) {
  const tiers = [
    { id: "ed", label: "Ed" },
    { id: "humza", label: "Humza" },
  ];
  const unassigned = quotes.filter((entry) => entry.speaker === null);
  return rankQuestion({
    id: "ed-or-humza",
    title: "Ed or Humza?",
    prompt: "Who said it? Sort every quote into Ed or Humza.",
    presentation: "ed-or-humza",
    instructions:
      "Pick Ed or Humza for every quote. You can change your picks before sending the whole list.",
    input: "buckets",
    scoring: "placement",
    mode: "complete",
    ties: "shared",
    collectMs: 120_000,
    items: quotes.map((entry) => ({ id: entry.id, label: entry.quote })),
    tiers,
    media: [
      {
        name: "ed",
        kind: "image",
        required: true,
        asset: "/assets/questions/ed-or-humza/ed.webp",
        credit: "Photo supplied by Humza (private use)",
        alt: "Ed",
      },
      {
        name: "humza",
        kind: "image",
        required: true,
        asset: "/assets/questions/ed-or-humza/humza.webp",
        credit: "Photo supplied by Humza (private use)",
        alt: "Humza",
      },
      {
        name: "ed-portrait",
        kind: "image",
        required: true,
        asset: "/assets/questions/ed-or-humza/ed-portrait.webp",
        credit: "Photo supplied by Humza (private use)",
        alt: "Ed",
      },
      {
        name: "humza-portrait",
        kind: "image",
        required: true,
        asset: "/assets/questions/ed-or-humza/humza-portrait.webp",
        credit: "Photo supplied by Humza (private use)",
        alt: "Humza",
      },
    ],
    truth: unassigned.length
      ? {
          missing: {
            code: "truth",
            name: "quote-speakers",
            detail: `Confirm the speaker for ${unassigned.length} quotes: ${unassigned.map((entry) => entry.id).join(", ")}.`,
          },
        }
      : {
          known: tiers
            .map((tier) => ({
              tierId: tier.id,
              itemIds: quotes
                .filter((entry) => entry.speaker === tier.id)
                .map((entry) => entry.id),
            }))
            .filter((group) => group.itemIds.length > 0),
        },
    notes:
      "Personal quotes supplied by Humza, 17 November 2026; wording preserved, speakers unconfirmed. TODO owner: set each speaker to ed or humza; null keeps this a draft. Photos of Ed and Humza supplied by Humza for private party use (avatars plus projector portraits). Card-stack presentation ed-or-humza. One whole-list submission; 80 points proportional to correct placements, rounded down; two minutes, no speed bonus. Speaker keys stay server-side.",
  });
}

export const edOrHumza = makeEdOrHumza();
