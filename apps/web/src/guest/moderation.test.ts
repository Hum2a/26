import { describe, expect, it } from "vitest";
import { blockedAnswer, blockedNickname, normaliseForScreening } from "@26/shared";

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

describe("written answers", () => {
  it("refuses identity slurs, including plurals, spacing, look-alikes and longer words", () => {
    for (const encoded of [
      "Zl zngr vf n puvax",
      "j b t",
      "Nfx gur x1xrf",
      "Gbgny snttbgf",
      "ergneqf ehyr",
      "Hapyr Nmvm'f n cnxv",
    ])
      expect(blockedAnswer(rot13(encoded)), encoded).toBe(true);
  });

  it("allows swearing, crude jokes and dark humour that nicknames refuse", () => {
    for (const encoded of [
      // Swearing and explicit terms are nickname-only.
      "Uhzmn vf n zbgureshpxre ng pneqf",
      "Fur'f n phag gb ybfr gb",
      "Qnir gur Encvfg",
      "Rkcyvpvgyl n cnrqb ung",
    ])
      expect(blockedAnswer(rot13(encoded)), encoded).toBe(false);
    for (const answer of [
      "Shit at quizzes and worse at karaoke",
      "Went for a fag break and never came back",
      "Humza's mum, obviously",
      "The fag got soggy in the rain",
      "Scunthorpe United's worst ever signing",
      "Spicy chicken and regret",
      "The raccoon did it",
      "Stifled a snigger at the funeral",
      "A niggardly tip",
      "Grape escape",
      "",
    ])
      expect(blockedAnswer(answer), answer).toBe(false);
  });
});
