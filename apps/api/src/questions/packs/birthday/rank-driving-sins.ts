import { rankQuestion } from "../../authoring.ts";

export const rankDrivingSins = rankQuestion({
  id: "rank-driving-sins",
  title: "Rank the sins: UK driving",
  prompt:
    "Rank these UK driving offenses from ‘mildly annoying’ to ‘immediate revocation of human rights’.",
  instructions:
    "Order the offences from least to most sinful. This draft has no agreed target order yet.",
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
  truth: {
    missing: {
      code: "truth",
      name: "ranking-target",
      detail:
        "Confirm Humza's target order, or define how a room-consensus target is produced and scored. No ranking was supplied.",
    },
  },
  requirements: [
    {
      code: "truth",
      name: "consensus-ranking",
      detail:
        "Resolve fixed order matching versus room consensus; consensus aggregation and tie rules are not implemented by fixed-target ranking.",
    },
    {
      code: "items",
      name: "drag-ordering",
      detail:
        "The requested ordered-list drag-and-drop control; existing ranking uses accessible tier assignment rather than this specific interaction.",
    },
  ],
  notes:
    "Subjective comic severity, not a statement about legal penalties or loss of rights. Preserves supplied order as an item list only, never as the answer. No target, consensus rule or drag-list behaviour is invented. See docs/content/party-concepts.md.",
});
