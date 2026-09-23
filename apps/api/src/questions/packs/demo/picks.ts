import { voteQuestion } from "../../authoring.ts";

export const picks = voteQuestion({
  id: "picks",
  title: "Spare line",
  status: "ready",
  prompt: "Illustrative demo: write a spare line.",
  points: 40,
  collectMs: 20_000,
  voteMs: 20_000,
  attribution: "never",
  candidateMode: "shortlist",
});
