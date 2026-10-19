import { typedQuestion } from "../../authoring.ts";

// Authoring placeholder only. Repeated Wordle guesses and letter feedback are
// not implemented by the ordinary single-submission typed mechanic.
// Reference inspected in ../Encore: packages/game-glyph/src/{mark,play,glyph.test}.ts
// and apps/web/src/games/glyph-board.tsx. Root licence: MIT, copyright 2026
// Encore contributors. Preserve that notice and dictionary attributions if ported.
// Encore's puzzle/play state contains answers: port server-side marking/validation,
// never that state into public guest snapshots.
export const completeAWordle = typedQuestion({
  id: "complete-a-wordle",
  title: "Complete a Wordle",
  prompt: "Complete a wordle",
  status: "draft",
  notes:
    "Encore's local Glyph source and MIT licence have been located; port references are recorded above. Preserve repeated guesses and letter feedback rather than substituting single-answer typed matching. Target word, attempt/time limits and scoring remain unspecified.",
  requirements: [
    {
      code: "truth",
      name: "wordle-mechanic",
      detail:
        "a server-authoritative repeated-guess mechanic, per-letter feedback, allowed-word rules, attempt/time limits and scoring; the current typed mechanic does not implement Wordle.",
    },
  ],
  accepted: {
    missing: {
      code: "correct-answer",
      name: "target-word",
      detail: "the target word for the Wordle round.",
    },
  },
});
