import { choiceQuestion } from "../../authoring.ts";

export const trolleyMamdaniAfrica = choiceQuestion({
  id: "trolley-mamdani-africa",
  presentation: "trolley-lever",
  title: "Trolley: Mayor Mamdani vs Africa",
  prompt:
    "The trolley is heading for everyone in Africa. Pull the lever to hit Mayor Zohran Mamdani instead. Do you?",
  instructions:
    "Pick one, then commit. Your choice decides who is saved. No points; just the room’s verdict.",
  outcome: { kind: "poll" },
  options: [
    { id: "derail", label: "Pull: save Africa; Mamdani dies" },
    { id: "leave", label: "Leave: save Mamdani; Africa dies" },
  ],
  explanation:
    "The trolley company has declined to explain how its African route works.",
  notes:
    "User’s Mamadani interpreted as Mayor Zohran Mamdani; spelling/title checked at https://www.nyc.gov/mayors-office on 20 October 2026. Africa means everyone on the continent, not a population estimate. Fictional, unscored dilemma; no correct answer. As in the original, pulling diverts the trolley from the larger group towards one person.",
});
