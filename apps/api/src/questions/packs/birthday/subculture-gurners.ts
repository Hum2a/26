import { choiceQuestion } from "../../authoring.ts";

export const subcultureGurners = choiceQuestion({
  id: "subculture-gurners",
  title: "Real British subculture: Gurners",
  prompt:
    "Gurners: competitive face-distorting contestants in Cumbria. Real or made up?",
  instructions: "Pick Real or Made up, then send.",
  options: [
    { id: "real", label: "Real" },
    { id: "made-up", label: "Made up" },
  ],
  correctOption: { known: "real" },
  explanation:
    "Real — Egremont Crab Fair in Cumbria hosts the World Gurning Championships. Competitive face-pulling has an actual world championship.",
  notes:
    "User supplied Real. Verified against the organiser’s history and entry FAQs: https://egremontcrabfair.com/history.html and https://egremontcrabfair.com/faqs.html. No current event date or invented record is claimed. See docs/content/party-concepts.md.",
});
