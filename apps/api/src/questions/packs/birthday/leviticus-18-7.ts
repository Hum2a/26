import { choiceQuestion } from "../../authoring.ts";

// The other options are based on Leviticus 18:8, 18:13 and 18:16 respectively.
// Neutral ids avoid exposing which verse each option represents.
export const leviticus187 = choiceQuestion({
  id: "leviticus-18-7",
  presentation: "scripture",
  title: "Leviticus 18:7",
  prompt: "Which statement paraphrases Leviticus 18:7?",
  options: [
    {
      id: "a",
      label:
        "Do not dishonour your father by having sexual relations with your stepmother",
    },
    {
      id: "b",
      label: "Do not dishonour your mother by having sexual relations with her sister",
    },
    {
      id: "c",
      label: "Do not dishonour your father by having sexual relations with your mother",
    },
    {
      id: "d",
      label: "Do not dishonour your brother by having sexual relations with his wife",
    },
  ],
  correctOption: { known: "c" },
  explanation:
    "Leviticus 18:7 (KJV): “The nakedness of thy father, or the nakedness of thy mother, shalt thou not uncover: she is thy mother; thou shalt not uncover her nakedness.”",
});
