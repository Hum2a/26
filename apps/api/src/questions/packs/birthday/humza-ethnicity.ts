import { choiceQuestion } from "../../authoring.ts";

export const humzaEthnicity = choiceQuestion({
  id: "humza-ethnicity",
  title: "Humza's ethnicity",
  prompt: "Guess Humza's ethnicity",
  instructions:
    "Select every country that applies, then send. +50 per right pick, −50 per wrong pick (min 0).",
  outcome: {
    kind: "multiple",
    optionIds: ["pakistan", "tanzania"],
    scoring: "partial",
  },
  options: [
    { id: "pakistan", label: "Pakistan" },
    { id: "india", label: "India" },
    { id: "tanzania", label: "Tanzania" },
    { id: "kenya", label: "Kenya" },
    { id: "bangladesh", label: "Bangladesh" },
    { id: "uganda", label: "Uganda" },
    { id: "iran", label: "Iran" },
    { id: "egypt", label: "Egypt" },
  ],
  explanation:
    "Pakistan and Tanzania! You earn 50 points per right country, minus 50 for any wrong pick (minimum 0).",
  notes:
    "Answer supplied by Humza, 20 November 2026: Pakistan + Tanzania. Multi-select choice with partial credit (+50 per right country, -50 per wrong pick, min 0). Six decoy countries added as defaults and can be swapped anytime.",
});
