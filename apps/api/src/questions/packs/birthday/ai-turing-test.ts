import { choiceQuestion } from "../../authoring.ts";

export const aiTuringTest = choiceQuestion({
  id: "ai-turing-test",
  title: "The AI Turing Test: Humza edition",
  prompt:
    "Which of these takes did the birthday boy actually argue passionately for 45 minutes at 2 AM?",
  instructions:
    "Pick the genuine Humza response, then send. These draft options are examples only.",
  options: [
    {
      id: "scooters",
      label: "Electric scooters should require a full UK driving test.",
    },
    { id: "anime", label: "Subbed anime is inherently classist." },
    {
      id: "prius",
      label: "The Toyota Prius is objectively the peak of automotive design.",
    },
  ],
  correctOption: {
    missing: {
      code: "correct-answer",
      name: "genuine-response",
      detail:
        "One confirmed genuine Humza response and its correct option id; none of the supplied examples is identified as genuine.",
    },
  },
  requirements: [
    {
      code: "truth",
      name: "personal-source",
      detail:
        "Actual supplied opinion/message samples and two approved/generated decoys. Do not invent Humza's opinions or claim these examples are his messages.",
    },
  ],
  notes:
    "One genuine take among two generated decoys. User supplied three illustrative options but did not identify a true one or provide actual message samples. Reuse choice scoring once confirmed; no external AI service or personal-history fabrication is needed. Draft only. See docs/content/party-concepts.md.",
});
