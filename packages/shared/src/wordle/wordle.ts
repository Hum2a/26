import { z } from "zod";

export const wordleMarkSchema = z.enum(["absent", "present", "correct"]);
export type WordleMark = z.infer<typeof wordleMarkSchema>;
export const wordleBoardSchema = z
  .object({
    kind: z.literal("wordle"),
    guesses: z
      .array(
        z
          .object({
            word: z.string().regex(/^[A-Z]{5}$/),
            marks: z.array(wordleMarkSchema).length(5),
          })
          .strict(),
      )
      .max(6),
    status: z.enum(["playing", "won", "lost"]),
  })
  .strict();
export type WordleBoard = z.infer<typeof wordleBoardSchema>;
export const emptyWordleBoard = (): WordleBoard => ({
  kind: "wordle",
  guesses: [],
  status: "playing",
});

/** Two passes ensure a repeated letter can only use each answer letter once.
 * Adapted from Encore Glyph, MIT. See docs/licenses/encore-glyph.md. */
export function markWordle(guess: string, answer: string): WordleMark[] {
  if (guess.length !== 5 || answer.length !== 5)
    throw new Error("Wordle uses five letters.");
  const marks: WordleMark[] = Array.from({ length: 5 }, () => "absent");
  const remaining = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct";
    else remaining.set(answer[i]!, (remaining.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++) {
    const letter = guess[i]!;
    if (marks[i] !== "correct" && (remaining.get(letter) ?? 0) > 0) {
      marks[i] = "present";
      remaining.set(letter, remaining.get(letter)! - 1);
    }
  }
  return marks;
}

/** Server-only caller supplies the secret and dictionary. Time is injected. */
export function reduceWordle(
  board: WordleBoard,
  value: unknown,
  rules: { answer: string; isWord: (word: string) => boolean; deadline: number },
  now: number,
): { ok: true; state: WordleBoard } | { ok: false; message: string } {
  if (now >= rules.deadline)
    return { ok: false, message: "Time is up. Watch the stage." };
  if (board.status !== "playing" || board.guesses.length >= 6)
    return { ok: false, message: "Your board is finished. Watch the stage." };
  const word = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]{5}$/.test(word))
    return { ok: false, message: "Enter a five-letter word." };
  if (board.guesses.some((guess) => guess.word === word))
    return { ok: false, message: "You’ve already tried that word." };
  if (word !== rules.answer && !rules.isWord(word))
    return { ok: false, message: "That word isn’t in the word list. Try another." };
  const guesses = [...board.guesses, { word, marks: markWordle(word, rules.answer) }];
  return {
    ok: true,
    state: {
      kind: "wordle",
      guesses,
      status: word === rules.answer ? "won" : guesses.length === 6 ? "lost" : "playing",
    },
  };
}
