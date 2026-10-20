import { choiceQuestion } from "../../authoring.ts";

export const trolleyYourMum = choiceQuestion({
  id: "trolley-your-mum",
  presentation: "trolley-lever",
  title: "Trolley: your mum vs 1,000 people",
  prompt:
    "The trolley is heading for 1,000 random people. Pull the lever to hit your mum instead. Do you?",
  instructions:
    "Pick one, then commit. Your choice decides who is saved. No points; just the room’s verdict.",
  outcome: { kind: "poll" },
  options: [
    { id: "derail", label: "Pull: save 1,000; your mum dies" },
    { id: "leave", label: "Leave: save your mum; 1,000 die" },
  ],
  explanation:
    "A thousand strangers. One mum. The family group chat would like a word.",
  notes:
    "An unscored hypothetical, matching the original trolley poll. The trolley initially heads towards the larger group; pulling diverts it towards your mum. No morally correct answer is assigned.",
});
