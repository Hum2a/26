/**
 * Conservative screening for a party projector. Words are stored
 * ROT13-encoded so the source does not read as a list of slurs. Short words
 * match whole words only, so names like "Scunthorpe" pass.
 *
 * Two policies share one list:
 * - Nicknames (`blockedNickname`) refuse identity slurs and explicit sexual or
 *   abusive terms, because a name stays on the big screen all night.
 * - Written answers (`blockedAnswer`) refuse identity slurs only. Swearing,
 *   crude jokes and dark humour are the point of the game and pass. "fag" is
 *   left out for answers because in British English it is also a cigarette.
 */
const rot13 = (text: string) =>
  text.replace(/[a-z]/g, (c) =>
    String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97),
  );

/** Identity slurs: refused in nicknames and in answers. */
const slurWords = [
  "snttbg",
  "avttre",
  "avttn",
  "avttnf",
  "cnxv",
  "cnxvf",
  "puvax",
  "fcvp",
  "xvxr",
  "genaal",
  "ergneq",
  "pbba",
  "jbt",
  "tbbx",
  "qlxr",
].map(rot13);
/** Slurs that are refused inside a longer word too. */
const slurAnywhere = ["avttre", "avttn", "snttbg"].map(rot13);

/** Nickname-only whole words: the cigarette-ambiguous slur and explicit terms. */
const nicknameOnlyWords = ["phag", "snt", "sntf", "encr", "encvfg"].map(rot13);
const nicknameOnlyAnywhere = [
  "cnrqb",
  "crqbcuvyr",
  "cnrqbcuvyr",
  "pbpxfhpxre",
  "zbgureshpxre",
].map(rot13);

const nicknameWords = new Set([...slurWords, ...nicknameOnlyWords]);
const nicknameAnywhere = [...slurAnywhere, ...nicknameOnlyAnywhere];
const answerWords = new Set(slurWords);
/** Ordinary words that contain a slur's letters: "snigger" and "niggard(ly)". */
const answerExemptStems = ["favttre", "avttneq"].map(rot13);

const lookalikes: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "8": "b",
};

/** Lower case, no accents, look-alike digits mapped, words split on anything else. */
export function normaliseForScreening(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0-9!|@$]/g, (c) => lookalikes[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** True when a nickname should be refused at the door. */
export function blockedNickname(text: string): boolean {
  const normal = normaliseForScreening(text);
  if (!normal) return false;
  const words = normal.split(" ");
  if (words.some((word) => nicknameWords.has(word))) return true;
  // A short term spelled out with separators ("k-i-k-e") is one word joined.
  const joined = words.join("");
  if (nicknameWords.has(joined)) return true;
  return nicknameAnywhere.some((term) => joined.includes(term));
}

/**
 * True when a written answer contains an identity slur. Answers are longer
 * than names, so terms are matched inside each word rather than across the
 * whole answer joined up ("fag got" is not "faggot"). Runs of single letters
 * are joined, so a slur spelled out letter by letter is still caught.
 */
export function blockedAnswer(text: string): boolean {
  const normal = normaliseForScreening(text);
  if (!normal) return false;
  const tokens: string[] = [];
  let spelled = "";
  for (const word of normal.split(" ")) {
    if (word.length === 1) {
      spelled += word;
      continue;
    }
    if (spelled) tokens.push(spelled);
    spelled = "";
    tokens.push(word);
  }
  if (spelled) tokens.push(spelled);
  return tokens.some(
    (token) =>
      answerWords.has(token) ||
      (token.endsWith("s") && answerWords.has(token.slice(0, -1))) ||
      (!answerExemptStems.some((stem) => token.startsWith(stem)) &&
        slurAnywhere.some((term) => token.includes(term))),
  );
}
