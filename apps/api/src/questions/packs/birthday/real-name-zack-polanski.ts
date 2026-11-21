import { choiceQuestion } from "../../authoring.ts";

// Design brief: a deed-poll certificate; the old name is stamped out at the reveal.
export const realNameZackPolanski = choiceQuestion({
  id: "real-name-zack-polanski",
  presentation: "deed-poll",
  title: "Real name: Zack Polanski",
  prompt: "What was their real name? Zack Polanski",
  options: [
    { id: "david-paulden", label: "David Paulden" },
    { id: "daniel-rosen", label: "Daniel Rosen" },
    { id: "joshua-marks", label: "Joshua Marks" },
    { id: "oliver-grant", label: "Oliver Grant" },
  ],
  correctOption: { known: "david-paulden" },
  explanation: "Zack Polanski was born David Paulden and changed his name at 18.",
});
