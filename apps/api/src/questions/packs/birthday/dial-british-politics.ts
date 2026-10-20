import { sliderQuestion } from "../../authoring.ts";

export const dialBritishPolitics = sliderQuestion({
  id: "dial-british-politics",
  title: "The Dial-In: British politics",
  prompt: "Predict the room’s middle ground: British Politics.",
  instructions:
    "0 = “Optimistic about the NHS” | 100 = “Ready to vote for Count Binface as permanent dictator.”",
  minimum: 0,
  maximum: 100,
  step: 1,
  initial: 50,
  unit: "/100",
  scoring: "consensus",
  truth: { known: null },
  explanation:
    "Find the room’s middle ground. The median accepted answer is the target. Score up to 100 for closeness; ties score equally. No answer means no points.",
  notes:
    "Room-consensus interpretation: target is the median of eligible accepted responses, frozen at reveal. No personal Humza opinion is claimed. Points round(100 × (1 − distance / 100)). Endpoints are supplied comic opinions; initial 50 is a neutral control position.",
});
