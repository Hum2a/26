import { sliderQuestion } from "../../authoring.ts";

export const dialLondonGeography = sliderQuestion({
  id: "dial-london-geography",
  title: "The Dial-In: London geography",
  prompt: "Predict the room’s middle ground: London Geography.",
  instructions:
    "0 = “Zone 5 is still London” | 100 = “If you can't hear Big Ben, you live in the countryside.”",
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
