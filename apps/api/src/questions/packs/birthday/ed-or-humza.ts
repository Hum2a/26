import { rankQuestion } from "../../authoring.ts";

export type QuoteSpeaker = "ed" | "humza" | "neither";
export type EdOrHumzaQuote = {
  id: string;
  quote: string;
  speaker: QuoteSpeaker | null;
};

/** Speakers confirmed by Humza, 19 November 2026. Append quotes with new stable ids. */
export const edOrHumzaQuotes: readonly EdOrHumzaQuote[] = [
  {
    id: "quote-01",
    quote: "I'd baptise a baby with a water pressure jet just to make the local news",
    speaker: "humza",
  },
  {
    id: "quote-02",
    quote: "I sense Israel in your general direction",
    speaker: "humza",
  },
  { id: "quote-03", quote: "You're ass is in grabbing distance", speaker: "ed" },
  {
    id: "quote-04",
    quote: "You're talking a lot of shit for a washing machine",
    speaker: "humza",
  },
  {
    id: "quote-05",
    quote: "Sometimes bad men have to do bad things to teach women a lesson",
    speaker: "neither",
  },
  {
    id: "quote-06",
    quote:
      "If jensan can bang all those baddies with a 1 incher imagine what I can do with a 9mm",
    speaker: "neither",
  },
  { id: "quote-07", quote: "Biblically accurate breasts on that one", speaker: "ed" },
  {
    id: "quote-08",
    quote: "Internally I feel external and externally I feel internal",
    speaker: "ed",
  },
  { id: "quote-09", quote: "A creampie. His cum in your vagina.", speaker: "ed" },
  { id: "quote-10", quote: "No exchange of bodily fluids occurred", speaker: "ed" },
  {
    id: "quote-11",
    quote:
      "(In response to how was your Christmas) It was good. Busted one out in your memory",
    speaker: "ed",
  },
  {
    id: "quote-12",
    quote:
      "You know Belinda asked me if I wanted to get a fleshlight and I said only if it came inside a doll of the main character from zootopia",
    speaker: "ed",
  },
  {
    id: "quote-13",
    quote: "I’ve decided that I’m going to bust to the thought of you tonight",
    speaker: "ed",
  },
  { id: "quote-14", quote: "The classic - I’m going to touch you", speaker: "ed" },
  { id: "quote-15", quote: "you're tits are looking great today", speaker: "ed" },
  { id: "quote-16", quote: "You would've been worth the jail time", speaker: "ed" },
  {
    id: "quote-17",
    quote: "If they don't want a dick they can give the inches to me",
    speaker: "neither",
  },
  {
    id: "quote-18",
    quote: "Smaller but firm can outperform larger but drippy",
    speaker: "humza",
  },
  {
    id: "quote-19",
    quote:
      "It's a good thing you removed him from the GC before I was starused to say the N word",
    speaker: "humza",
  },
  {
    id: "quote-20",
    quote: "If n***a is feminine then n***o would be masculine wouldn't it",
    speaker: "humza",
  },
  {
    id: "quote-21",
    quote: "Make no mistake I also love beating women",
    speaker: "humza",
  },
  {
    id: "quote-22",
    quote: "if we make prostitution a charity action, it's no longer illegal",
    speaker: "humza",
  },
  {
    id: "quote-23",
    quote:
      "let's go digging for diamonds or whatever else crystalised in that forgotten cave",
    speaker: "humza",
  },
];

/** Answer-key configuration stays server-side; previews receive only quote text and names. */
export function makeEdOrHumza(quotes: readonly EdOrHumzaQuote[] = edOrHumzaQuotes) {
  const tiers = [
    { id: "ed", label: "Ed" },
    { id: "humza", label: "Humza" },
    { id: "neither", label: "Neither" },
  ];
  const unassigned = quotes.filter((entry) => entry.speaker === null);
  return rankQuestion({
    id: "ed-or-humza",
    title: "Ed or Humza?",
    prompt: "Who said it? Sort every quote into Ed, Humza or Neither.",
    presentation: "ed-or-humza",
    instructions:
      "Pick Ed, Humza or Neither for every quote. You can change your picks before sending the whole list.",
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
      "Quotes from Humza, 17 Nov 2026, wording preserved; speakers confirmed 19 Nov, five more Humza lines 21 Nov; quote-05, quote-06 and quote-17 marked Neither the same night. Sort into Ed, Humza or Neither. Private photos. Card-stack ed-or-humza. Whole-list submit; 80 points by placements, two minutes. Keys stay server-side. Ready in the catalogue; adding it to the running order is a separate host action.",
  });
}

export const edOrHumza = makeEdOrHumza();
