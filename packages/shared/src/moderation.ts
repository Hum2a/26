/**
 * Conservative nickname screening for a party projector. It blocks slurs and
 * explicit sexual terms; ordinary swearing between friends is allowed. Words
 * are stored ROT13-encoded so the source does not read as a list of slurs.
 * Short words match whole words only, so names like "Scunthorpe" pass.
 */
const rot13 = (text: string) =>
  text.replace(/[a-z]/g, (c) =>
    String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97),
  );

const wholeWords = new Set(
  [
    "phag",
    "snt",
    "sntf",
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
    "encr",
    "encvfg",
    "pbba",
    "jbt",
    "tbbx",
    "qlxr",
  ].map(rot13),
);
const anywhere = [
  "avttre",
  "avttn",
  "snttbg",
  "cnrqb",
  "crqbcuvyr",
  "cnrqbcuvyr",
  "pbpxfhpxre",
  "zbgureshpxre",
].map(rot13);

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
    .replace(/[\u0300-\u036f]/g, "")
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
  if (words.some((word) => wholeWords.has(word))) return true;
  // A short term spelled out with separators ("k-i-k-e") is one word joined.
  const joined = words.join("");
  if (wholeWords.has(joined)) return true;
  return anywhere.some((term) => joined.includes(term));
}
