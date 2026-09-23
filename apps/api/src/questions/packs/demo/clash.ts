import { duelQuestion } from "../../authoring.ts";

export const clash = duelQuestion({
  id: "clash",
  title: "Closer to 26",
  status: "ready",
  prompt: "Illustrative demo: get closer to 26 than your opponent.",
  points: 50,
  collectMs: 20_000,
  attribution: "after",
  minimum: 0,
  maximum: 50,
  step: 1,
  target: 26,
  within: 2,
  tieBreak: "off",
});
