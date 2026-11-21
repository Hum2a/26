import { guessQuestion } from "../../authoring.ts";

export const bestDressed = guessQuestion({
  id: "best-dressed",
  title: "Best dressed",
  prompt: "Who is best dressed tonight?",
  instructions:
    "Vote for the best dressed guest in the room. Self-votes are allowed. Most votes wins.",
  points: 100,
  collectMs: 30_000,
  roster: "room",
  scoring: "majority",
  award: "nominees",
  selfVote: "allowed",
  explanation:
    "The guest with the most votes wins Best Dressed and takes the points. Tied winners each take the full award.",
  notes:
    "Final round, placed after kart-sprint at the user's request (20 November 2026). Whole-room ballot with self-votes allowed; 30 seconds to search and pick. The most-voted player(s) receive 100 points, shared on a tie.",
});
