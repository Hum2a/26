import { guessQuestion } from "../../authoring.ts";

export const guessemotionalsupport = guessQuestion({
  id: "guess-emotional-support",
  title: "Emotional support air fryer",
  prompt:
    "Who would bring an emotional support air fryer to a funeral and ask where the sockets are?",
  instructions:
    "Pick the guest most likely to do this. The room’s most popular pick wins.",
  scoring: "majority",
  selfVote: "allowed",
  notes:
    "Fictional scenario; no claim about an actual guest. Created at the user’s request on 16 November 2026.",
});
