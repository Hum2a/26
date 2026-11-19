export type TextControl = HTMLInputElement | HTMLTextAreaElement;

/** Sets a controlled input's value so React sees it as typing. */
export function setNativeValue(element: TextControl, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

export function pigLatin(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    const match = /^([^aeiou]*)(.*)$/.exec(lower);
    const head = match?.[1] ?? "";
    const rest = match?.[2] ?? "";
    const latin =
      head === "" ? `${lower}way` : rest === "" ? `${lower}ay` : `${rest}${head}ay`;
    return word[0] === word[0]?.toUpperCase()
      ? latin[0]!.toUpperCase() + latin.slice(1)
      : latin;
  });
}

/** Words that autocorrect "helps" with when a word is finished. */
export const autocorrections: Readonly<Record<string, string>> = {
  the: "thee",
  yes: "yass",
  no: "nah mate",
  good: "gucci",
  great: "grate",
  love: "tolerate",
  party: "pity party",
  cake: "cheesecake",
  birthday: "bathday",
  best: "beast",
  friend: "fiend",
  happy: "hippo",
  you: "ewe",
  and: "und",
  because: "becoz",
  drink: "drank",
  food: "fud",
  definitely: "defiantly",
  humza: "Hamza",
  answer: "anser",
};

/** Replaces the word just finished, if autocorrect has an opinion about it. */
export function autocorrect(value: string): string {
  const match = /([A-Za-z]+)([\s.,!?])$/.exec(value);
  if (!match) return value;
  const word = match[1]!;
  const correction = autocorrections[word.toLowerCase()];
  if (!correction) return value;
  return value.slice(0, value.length - match[0].length) + correction + match[2];
}
