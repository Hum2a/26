import { choiceQuestion } from "../../authoring.ts";

// Design brief: a scripture page. Each option is set as a verse in an old
// typeface. Option ids are neutral letters so the verse number is not public.
// The three wrong options are the real KJV Leviticus 18:8, 18:13 and 18:16.
// Labels are opening words because a label is at most 80 characters.
export const leviticus187 = choiceQuestion({
  id: "leviticus-18-7",
  presentation: "scripture",
  title: "Leviticus 18:7",
  prompt: "Which of these is Leviticus 18:7?",
  options: [
    { id: "a", label: "The nakedness of thy father's wife shalt thou not uncover…" },
    { id: "b", label: "Thou shalt not uncover the nakedness of thy mother's sister…" },
    { id: "c", label: "The nakedness of thy father, or the nakedness of thy mother…" },
    { id: "d", label: "Thou shalt not uncover the nakedness of thy brother's wife…" },
  ],
  correctOption: { known: "c" },
  explanation:
    "Leviticus 18:7 (KJV): “The nakedness of thy father, or the nakedness of thy mother, shalt thou not uncover: she is thy mother; thou shalt not uncover her nakedness.”",
});
