import { choiceQuestion } from "../../authoring.ts";

export const christianityBranches = choiceQuestion({
  id: "christianity-branches",
  title: "Branches of Christianity",
  prompt: "Which of these ARE branches of Christianity?",
  instructions: "Select all that apply.",
  outcome: { kind: "multiple", optionIds: ["muggletonians", "the-jumpers", "ranters"] },
  explanation:
    "Muggletonians, the Jumpers and Ranters are the three historical names. All three, and no decoys, earns 100 points.",
  notes:
    "User confirmed ARE and the answer set. Exact-set scoring: all three without any decoy = 100, otherwise 0. Historical labels cover dissenting movements rather than uniform present-day denominations. No speed bonus.",
  options: [
    { id: "unorthodox", label: "unorthodox" },
    { id: "jisraeli", label: "jisraeli" },
    { id: "irish-terrorists", label: "Irish Catholic terrorists" },
    { id: "muggletonians", label: "muggletonians" },
    { id: "the-jumpers", label: "the jumpers" },
    { id: "ranters", label: "ranters" },
  ],
});
