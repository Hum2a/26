import { choiceQuestion } from "../../authoring.ts";

export const trolleyFreddoMultiverse = choiceQuestion({
  id: "trolley-freddo-multiverse",
  presentation: "trolley-lever",
  title: "Trolley: one Freddo vs the multiverse",
  prompt:
    "The trolley will destroy all life in every universe. Pull the lever to squash one Freddo instead. Do you?",
  instructions:
    "Pick one, then commit. Your choice decides what survives. No points; just the room’s verdict.",
  outcome: { kind: "poll" },
  options: [
    { id: "derail", label: "Pull: save all life; squash Freddo" },
    { id: "leave", label: "Leave: save Freddo; all life ends" },
  ],
  explanation:
    "The multiverse has survived billions of years. Its final boss is a chocolate frog.",
  notes:
    "The user asked for an even more ridiculous third scenario. Original fictional escalation: one Freddo against all life in every universe, echoing the inflation rounds. Unscored poll, no correct answer or factual claim about other universes. Pulling sacrifices the single item, leaving sacrifices the larger side.",
});
