import { sliderQuestion } from "../../authoring.ts";

export const dialPopCulture = sliderQuestion({
  id: "dial-pop-culture",
  title: "The Dial-In: pop culture snobbery",
  prompt: "Predict the room’s middle ground: Pop Culture Snobbery.",
  instructions:
    "0 = “Let people enjoy things” | 100 = “If it wasn't made before 2004, it is slop.”",
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
