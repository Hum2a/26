import { voteQuestion } from "../../authoring.ts";

export const toast = voteQuestion({
  id: "toast",
  title: "Short toast",
  status: "ready",
  prompt: "Illustrative demo: write a short toast.",
  points: 60,
  collectMs: 20_000,
  voteMs: 20_000,
  attribution: "after",
  candidateMode: "all",
});
