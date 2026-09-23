import { guessQuestion } from "../../authoring.ts";

/** Bilal is a fixture name so this round can score. It is not a claim about a guest. */
export const who = guessQuestion({
  id: "who",
  title: "Playlist",
  status: "ready",
  prompt: "Illustrative demo: who is holding the playlist?",
  points: 80,
  collectMs: 20_000,
  attribution: "after",
  roster: "room",
  shortlist: [],
  scoring: "named",
  truth: { known: "Bilal" },
});
