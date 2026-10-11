/**
 * Pure matching for typed answers. Case, accents, punctuation, hyphens and
 * spacing are ignored. A small typo is forgiven: none up to 4 letters,
 * one up to 9, two beyond that. A swap of two neighbouring letters is one typo.
 */
export function normaliseTyped(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function typoAllowance(length: number): number {
  if (length <= 4) {
    return 0;
  }
  return length <= 9 ? 1 : 2;
}

export function matchTyped(
  body: string,
  accepted: readonly string[],
): { correct: boolean; matched: string | null } {
  const guess = compact(body);
  if (!guess) {
    return { correct: false, matched: null };
  }
  for (const answer of accepted) {
    const target = compact(answer);
    if (!target) {
      continue;
    }
    if (editDistance(guess, target) <= typoAllowance(target.length)) {
      return { correct: true, matched: answer };
    }
  }
  return { correct: false, matched: null };
}

function compact(text: string): string {
  return normaliseTyped(text).replace(/ /g, "");
}

/** Optimal string alignment distance: insert, delete, substitute, or swap neighbours. */
export function editDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)),
  );
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      let best = Math.min(
        (table[row - 1]?.[col] ?? 0) + 1,
        (table[row]?.[col - 1] ?? 0) + 1,
        (table[row - 1]?.[col - 1] ?? 0) + cost,
      );
      if (
        row > 1 &&
        col > 1 &&
        left[row - 1] === right[col - 2] &&
        left[row - 2] === right[col - 1]
      ) {
        best = Math.min(best, (table[row - 2]?.[col - 2] ?? 0) + 1);
      }
      const current = table[row];
      if (current) {
        current[col] = best;
      }
    }
  }
  return table[left.length]?.[right.length] ?? 0;
}
