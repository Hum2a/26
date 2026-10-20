import { rankQuestion } from "../../authoring.ts";

export const rankDrivingSins = rankQuestion({
  id: "rank-driving-sins",
  title: "Rank the sins: UK driving",
  prompt:
    "Rank these UK driving offenses from ‘mildly annoying’ to ‘immediate revocation of human rights’.",
  instructions:
    "Order the offences from least to most sinful. Match the room’s consensus to score.",
  items: [
    { id: "middle-lane", label: "Sitting in the middle lane of the M25 at 58 mph" },
    { id: "indicating", label: "Not indicating at a multi-lane roundabout" },
    { id: "high-beams", label: "Flashing high beams at someone doing 20 in a 20 zone" },
    {
      id: "charger",
      label: "Parking bumper-to-bumper behind a car plugged into a public charger",
    },
  ],
  tiers: [
    { id: "least", label: "Least sinful" },
    { id: "second", label: "Second" },
    { id: "third", label: "Third" },
    { id: "most", label: "Most sinful" },
  ],
  scoring: "consensus",
  input: "ordered",
  truth: { known: [] },
  explanation:
    "The room’s order comes from each item’s mean position. Tied mean positions stay tied. Score up to 80 for agreeing with the room’s ordered pairs.",
  notes:
    "Room-consensus interpretation, not a personal Humza ranking. Mean submitted positions create the frozen target at reveal; ties do not invent an order. Existing proportional pair-agreement score. The driving lines are comic opinions, not statements of legal penalties.",
});
