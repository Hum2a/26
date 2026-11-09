import { emptyWordleBoard, reduceWordle, wordlePreviewInputSchema } from "@26/shared";
import { isKnown, type AuthoredQuestion } from "../questions/definition.ts";
import { isWordleWord } from "../questions/wordle/wordle.ts";

/** Stateless admin rehearsal: replay words on the server, never trust client marks. */
export function previewWordle(question: AuthoredQuestion, input: unknown) {
  const parsed = wordlePreviewInputSchema.safeParse(input);
  if (!parsed.success || question.kind !== "wordle" || !isKnown(question.answer))
    return { ok: false as const, message: "This Wordle preview is unavailable." };
  let board = emptyWordleBoard();
  for (const word of [...parsed.data.history, parsed.data.word]) {
    const result = reduceWordle(
      board,
      word,
      { answer: question.answer.known, isWord: isWordleWord, deadline: 1 },
      0,
    );
    if (!result.ok) return result;
    board = result.state;
  }
  return { ok: true as const, state: board };
}

/** Also bounds chunked bodies; Content-Length alone is not a limit. */
export async function readWordlePreviewBody(
  request: Request,
  maximum = 1024,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return undefined;
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }
}
