import { choiceQuestion } from "../../authoring.ts";

// Design brief: a redacted file; the black bar lifts off the name at the reveal.
export const realNameTommyRobinson = choiceQuestion({
  id: "real-name-tommy-robinson",
  presentation: "redacted-file",
  title: "Real name: Tommy Robinson",
  prompt: "What was their real name? Tommy Robinson",
  options: [
    { id: "wayne-henderson", label: "Wayne Henderson" },
    { id: "darren-clarke-j", label: "Darren Clarke-Jones" },
    { id: "yaxley-lennon", label: "Stephen Yaxley-Lennon" },
    { id: "craig-thornton", label: "Craig Thornton" },
  ],
  correctOption: { known: "yaxley-lennon" },
  explanation: "Tommy Robinson's real name is Stephen Yaxley-Lennon.",
});
