import { choiceQuestion } from "../../authoring.ts";

export const tribunalReddit = choiceQuestion({
  id: "tribunal-reddit",
  title: "The Tribunal: redacted Reddit post",
  prompt:
    "AITA for refusing to attend my sister’s wedding because her fiancé drives a _______?",
  instructions: "Guess the real ending. Pick one, then send.",
  options: [
    {
      id: "corsa",
      label: "2008 Vauxhall Corsa with a fart-can exhaust",
    },
    {
      id: "tesla",
      label: "Custom wrap anime waifu Tesla",
    },
    {
      id: "audi",
      label: "White Audi on finance with no front plate",
    },
    {
      id: "hearse",
      label: "Hearse he uses as a daily commuter",
    },
  ],
  requirements: [
    {
      code: "truth",
      name: "reddit-source",
      detail:
        "Supply the actual thread, exact title and ending, and the top comment for the reveal.",
    },
  ],
  notes:
    "User-supplied example, not authenticated as a real Reddit title. Top-comment reveal needs the actual text/source; no comment or answer is invented. Correct guess uses ordinary choice points; showing the comment is not a separate bonus scoring rule.",
});
