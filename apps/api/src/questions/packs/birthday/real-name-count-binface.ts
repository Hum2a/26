import { choiceQuestion } from "../../authoring.ts";

// Design brief: a council-count podium with a bin lid; the name is unmasked at the reveal.
export const realNameCountBinface = choiceQuestion({
  id: "real-name-count-binface",
  presentation: "bin-unmasked",
  title: "Real name: Count Binface",
  prompt: "What was their real name? Count Binface",
  options: [
    { id: "graham-ellis", label: "Graham Ellis" },
    { id: "jon-harvey", label: "Jon Harvey" },
    { id: "neil-davies", label: "Neil Davies" },
    { id: "tim-bradshaw", label: "Tim Bradshaw" },
  ],
  correctOption: { known: "jon-harvey" },
  explanation: "Count Binface is the comedian Jon Harvey.",
});
