import { expect, it } from "vitest";
import { blockedNickname, normaliseForScreening } from "@26/shared";

// Fixtures are ROT13-encoded so the test does not spell out slurs.
const rot13 = (text: string) =>
  text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

it("refuses slurs, including spaced, accented and look-alike spellings", () => {
  for (const encoded of ["phag", "a1ttre", "SnTtbg", "x-v-x-r", "Qnir gur Encvfg"])
    expect(blockedNickname(rot13(encoded))).toBe(true);
});

it("allows ordinary names, friendly swearing and words that merely contain a term", () => {
  for (const name of [
    "Amina",
    "Scunthorpe",
    "The therapist",
    "Grape escape",
    "Spicy Chen",
    "Raccoon",
    "Dave88",
    "Bloody brilliant",
    "Shit at quizzes",
    "",
  ])
    expect(blockedNickname(name)).toBe(false);
});

it("normalises case, accents and look-alike characters", () => {
  expect(normaliseForScreening("Ãm1na_B0b!")).toBe("amina bobi");
});
