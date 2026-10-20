import { choiceQuestion } from "../../authoring.ts";

export const subcultureRantersMuggletonians = choiceQuestion({
  id: "subculture-ranters-muggletonians",
  title: "Real British subculture: Ranters / Muggletonians",
  prompt:
    "The Ranters / Muggletonians: names used for radical 17th-century English religious movements. Real or made up?",
  instructions: "Pick Real or Made up, then send.",
  options: [
    { id: "real", label: "Real" },
    { id: "made-up", label: "Made up" },
  ],
  correctOption: { known: "real" },
  explanation:
    "Real — both names appear in the history of 17th-century English religious dissent. Historians debate how coherent a single Ranter movement was; the names were not invented for this quiz.",
  notes:
    "User supplied Real. British Library catalogue: Treatises by Muggletonians, 17th–19th centuries. Historian Ariel Hessayon, The Ranters – part two, discusses contemporary Ranter labels. Wording tests historical names, not a claim of two uniform formal sects or an objective scale of heresy. See docs/content/party-concepts.md.",
});
