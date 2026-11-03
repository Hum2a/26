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
  collectMs: 30_000,
  speedBonus: null,
  outcome: {
    kind: "push",
    lines: [
      "how to clean mechanical keyboard",
      "is it illegal to keep a pigeon in a studio flat",
      "can police track incognito mode router logs",
      "how to fake your own death in Surrey",
    ],
    lineMs: 6_000,
    banks: [100, 250, 450, 700],
    raidAfter: [2, 3, 4, null],
  },
  notes:
    "Fictional escalating game text only. Numbers agreed with the user on 2 November 2026: a line every 6 seconds; the Raid follows line 2, 3 or 4, or never (one in four each), drawn when answering opens; banks 100 / 250 / 450 / 700. Bail before the Raid keeps the bank for the line showing; caught by the Raid scores 0; no Raid means everyone still in keeps 700.",
});
