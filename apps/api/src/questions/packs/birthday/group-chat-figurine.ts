import { guessQuestion } from "../../authoring.ts";

export const groupChatFigurine = guessQuestion({
  id: "group-chat-figurine",
  title: "Who’s in the group chat?",
  prompt:
    "I just dropped £400 on a Japanese imported figurine and told my mum it was an educational tax deduction.",
  instructions:
    "Who in this room is most capable of this? Vote secretly. Self-votes get double points for shameless honesty, if the room picks you too.",
  scoring: "majority",
  selfVote: "allowed",
  selfVoteBonus: "double",
  notes:
    "Player deduction / majority voting, not an undisclosed random imposter role. Uses the room roster without inventing names. Self-vote rule (user, 2 November 2026): a self-vote scores double only when you are also the room's most-voted person.",
});
