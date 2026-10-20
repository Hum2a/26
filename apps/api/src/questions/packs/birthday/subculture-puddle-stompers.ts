import { choiceQuestion } from "../../authoring.ts";

export const subculturePuddleStompers = choiceQuestion({
  id: "subculture-puddle-stompers",
  title: "Real British subculture: Puddle-Stompers",
  prompt:
    "The Puddle-Stompers of Eastbourne: an annual contest testing waterproof boot integrity. Real or made up?",
  instructions: "Pick Real or Made up, then send.",
  options: [
    { id: "real", label: "Real" },
    { id: "made-up", label: "Made up" },
  ],
  correctOption: { known: "made-up" },
  explanation:
    "Made up — the Puddle-Stompers and their boot-testing contest are the fictional example supplied for this quiz.",
  notes:
    "User explicitly supplied Fake. Treat this precise named setup as authored fiction, not a claim that no boot-testing event or similarly named club could exist anywhere. No fabricated source is needed for an explicitly invented decoy. See docs/content/party-concepts.md.",
});
