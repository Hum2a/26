import { guessQuestion } from "../../authoring.ts";

export const groupChatFigurine = guessQuestion({
  id: "group-chat-figurine",
  title: "Who’s in the group chat?",
  prompt:
    "I just dropped £400 on a Japanese imported figurine and told my mum it was an educational tax deduction.",
  instructions:
    "Who in this room is most capable of this? Vote secretly. Self-votes get double points for shameless honesty.",
  scoring: "majority",
  selfVote: "allowed",
  requirements: [
    {
      code: "truth",
      name: "self-vote-bonus",
      detail:
        "Implement the requested double-points self-vote rule using the existing score ledger; ordinary majority scoring does not include this bonus.",
    },
  ],
  notes:
    "Player deduction / majority voting, not an undisclosed random imposter role. Uses the room roster without inventing names. User requests a special self-vote bonus; leave draft until implemented.",
});
