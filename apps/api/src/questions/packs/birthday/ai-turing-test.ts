import { choiceQuestion } from "../../authoring.ts";

export const aiTuringTest = choiceQuestion({
  id: "ai-turing-test",
  title: "The AI Turing Test: Humza edition",
  prompt: "Which design take did Humza actually write while planning this game?",
  instructions: "One real Humza take. Two generated decoys. Pick one, then send.",
  options: [
    {
      id: "same-layout",
      label: "A consistent game needs every question to use the same layout.",
    },
    { id: "own-identity", label: "Everything can have its own identity." },
    {
      id: "stage-only",
      label: "Players should read questions only on the stage, never on their phones.",
    },
  ],
  correctOption: { known: "own-identity" },
  explanation:
    "The real take: everything can have its own identity. Humza wrote it when asking for clearer, full-screen questions. The other two are generated decoys. The birthday boy passed his own design review.",
  notes:
    "Primary source: the user's earlier message in this planning chat: ‘We dont need completely matching fields, everything can have its own identity’. Option uses the exact closing clause, capitalised with a full stop. Two decoys generated during this pass. Prompt names the real context; no invented 2 AM/45-minute argument or personal belief. Replaces the unconfirmed example options.",
});
