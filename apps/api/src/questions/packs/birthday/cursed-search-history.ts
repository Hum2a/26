import { choiceQuestion } from "../../authoring.ts";

export const cursedSearchHistory = choiceQuestion({
  id: "cursed-search-history",
  title: "Cursed search history: scrub or post?",
  prompt:
    "Hold your nerve as the search history gets worse. Hit BAIL to bank points before the Raid.",
  options: [
    {
      id: "bail",
      label: "BAIL",
    },
    {
      id: "hold",
      label: "Keep going",
    },
  ],
  outcome: {
    kind: "poll",
  },
  requirements: [
    {
      code: "truth",
      name: "push-your-luck",
      detail:
        "Implement server-owned escalating lines, a frozen random raid point, per-player bail receipts and the banked-point scoring rule.",
    },
  ],
  notes:
    "Supplied sequence: how to clean mechanical keyboard; is it illegal to keep a pigeon in a studio flat; can police track incognito mode router logs; how to fake your own death in Surrey. Fictional escalating game text only. Raid probability, line timing and points per line were not supplied. Disabled poll-shaped draft, not playable push-your-luck.",
});
