import type { CustomPresentationId, PlaySnapshot } from "@26/shared";

/**
 * Development-only preview data. Public question fields only: no answer keys.
 * A reveal here is a stand-in chosen in the preview, never the real answer.
 */
type PublicQuestion = PlaySnapshot["question"];

const core = {
  index: 1,
  total: 10,
  points: 100,
  illustrative: false,
  attribution: "after" as const,
};

const choice = {
  kind: "choice" as const,
  speedBonus: false,
  modifiers: [] as "double"[],
  suppressSpeedBonus: false,
};

export const previewQuestions: Record<CustomPresentationId, PublicQuestion> = {
  "who-said-it": {
    ...core,
    ...choice,
    id: "who-said-it-preview",
    presentation: "who-said-it",
    prompt:
      "A meeting without a spreadsheet is merely a gathering of unmeasured potential. Your calendar is the final frontier of ambition, and every empty cell is a missed opportunity.",
    options: [
      {
        id: "a",
        label: "An imaginary space-opera villain at the annual budget summit",
      },
      { id: "b", label: "A fictional productivity coach posting a quarterly update" },
    ],
  },
  glyph: {
    ...core,
    id: "word-lab-preview",
    presentation: "glyph",
    kind: "wordle",
    wordLength: 5,
    maxGuesses: 6,
    prompt: "Complete a wordle",
  },
  "now-playing": {
    ...core,
    ...choice,
    id: "favourite-genre",
    presentation: "now-playing",
    prompt: "What is my favourite genre of music?",
    options: [
      { id: "white-girl", label: "White girl bangers" },
      { id: "persona", label: "Persona music" },
      { id: "flute", label: "Shitty flute remixes on YouTube" },
      { id: "goat", label: "Screaming goat sounds" },
    ],
  },
  scripture: {
    ...core,
    ...choice,
    id: "leviticus-18-7",
    presentation: "scripture",
    prompt: "Which of these is Leviticus 18:7?",
    options: [
      { id: "a", label: "The nakedness of thy father's wife shalt thou not uncover…" },
      {
        id: "b",
        label: "Thou shalt not uncover the nakedness of thy mother's sister…",
      },
      {
        id: "c",
        label: "The nakedness of thy father, or the nakedness of thy mother…",
      },
      { id: "d", label: "Thou shalt not uncover the nakedness of thy brother's wife…" },
    ],
  },
  "number-plate": {
    ...core,
    ...choice,
    id: "car-name",
    presentation: "number-plate",
    prompt: "What do I call my car?",
    options: [
      { id: "hagakure", label: "Hagakure" },
      { id: "mr-brother", label: "Mr Brother" },
      { id: "the-leaf", label: "The Leaf" },
      { id: "sky", label: "Sky" },
    ],
  },
  "rage-meter": {
    ...core,
    id: "ignorance-triggers",
    presentation: "rage-meter",
    kind: "rank",
    points: 80,
    mode: "complete",
    ties: "forbidden",
    prompt:
      "Rank these conversational triggers by what type of ignorance pisses Humza off the fastest.",
    items: [
      { id: "apple", label: "Apple" },
      { id: "conspiracy", label: "Conspiracy theories" },
      { id: "palm-beach-pete", label: "Palm Beach Pete" },
      { id: "politics", label: "Politics" },
    ],
    tiers: [
      { id: "first", label: "Fastest" },
      { id: "second", label: "2nd" },
      { id: "third", label: "3rd" },
      { id: "fourth", label: "Slowest" },
    ],
  },
  "ballot-paper": {
    ...core,
    ...choice,
    id: "mock-election",
    presentation: "ballot-paper",
    points: 0,
    outcome: "poll",
    prompt: "Mock British election: vote for a party.",
    options: [
      { id: "labour", label: "Labour" },
      { id: "conservative", label: "Conservative" },
      { id: "reform", label: "Reform UK" },
      { id: "lib-dem", label: "Liberal Democrats" },
      { id: "green", label: "Green Party" },
      { id: "snp", label: "SNP" },
      { id: "plaid-cymru", label: "Plaid Cymru" },
      { id: "your-party", label: "Your Party" },
      { id: "workers-party", label: "Workers Party" },
      { id: "monster-raving", label: "Official Monster Raving Loony Party" },
      { id: "count-binface", label: "Count Binface Party" },
      { id: "dup", label: "DUP" },
      { id: "sinn-fein", label: "Sinn Féin" },
      { id: "alliance", label: "Alliance" },
      { id: "sdlp", label: "SDLP" },
      { id: "uup", label: "UUP" },
    ],
  },
  "red-blue-pill": {
    ...core,
    ...choice,
    id: "red-pill-blue-pill",
    presentation: "red-blue-pill",
    outcome: "threshold",
    prompt:
      "Everyone in the world has to take a blue pill or a red pill. If more than 50% pick blue, everyone lives. If not, red pills live and blue pills die.",
    options: [
      { id: "red", label: "Red pill" },
      { id: "blue", label: "Blue pill" },
    ],
  },
  "trolley-lever": {
    ...core,
    ...choice,
    id: "trolley-problem",
    presentation: "trolley-lever",
    points: 0,
    outcome: "poll",
    prompt:
      "A runaway trolley is heading for 1,000 imaginary planets. Pull the lever and it hits one imaginary moon instead. What do you do?",
    options: [
      { id: "derail", label: "Pull: save 1,000 imaginary planets; lose the moon" },
      { id: "leave", label: "Leave: save the moon; lose 1,000 imaginary planets" },
    ],
  },
  "bin-unmasked": {
    ...core,
    id: "real-name-count-binface",
    presentation: "bin-unmasked",
    kind: "typed",
    maxLength: 60,
    prompt: "What was their real name? Count Binface",
  },
  "deed-poll": {
    ...core,
    id: "real-name-zack-polanski",
    presentation: "deed-poll",
    kind: "typed",
    maxLength: 60,
    prompt: "What was their real name? Zack Polanski",
  },
  "redacted-file": {
    ...core,
    id: "real-name-tommy-robinson",
    presentation: "redacted-file",
    kind: "typed",
    maxLength: 60,
    prompt: "What was their real name? Tommy Robinson",
  },
};

/** A made-up spread of votes, so a poll reveal has something to draw. */
function spread(
  optionIds: string[],
  seed: number,
): { optionId: string; count: number }[] {
  return optionIds.map((optionId, index) => ({
    optionId,
    count: (seed * (index + 3) * 7) % 11,
  }));
}

/** A stand-in reveal. `pick` is the option the preview pretends is right. */
export function previewReveal(
  question: PublicQuestion,
  pick: string | undefined,
  seed: number,
): PlaySnapshot["reveal"] {
  if (question.kind === "choice") {
    const ids = question.options.map((option) => option.id);
    if (question.outcome === "poll") {
      return {
        kind: "choice",
        correctOptionId: null,
        outcome: "poll",
        tally: spread(ids, seed),
        winners: [],
        everyone: false,
        met: null,
      };
    }
    if (question.outcome === "threshold") {
      const tally = spread(ids, seed);
      const total = tally.reduce((sum, row) => sum + row.count, 0);
      const measured = tally.find((row) => row.optionId === "blue")?.count ?? 0;
      const met = total > 0 && measured / total > 0.5;
      return {
        kind: "choice",
        correctOptionId: null,
        outcome: "threshold",
        tally,
        winners: met ? [] : ids.filter((id) => id !== "blue"),
        everyone: met,
        met,
      };
    }
    return { kind: "choice", correctOptionId: pick ?? ids[0] ?? null };
  }
  if (question.kind === "rank") {
    return {
      kind: "rank",
      order: question.tiers.map((tier, index) => ({
        tierId: tier.id,
        label: tier.label,
        itemIds: [question.items[index]?.id ?? ""].filter(Boolean),
      })),
      rankings: [],
    };
  }
  if (question.kind === "wordle")
    return { kind: "wordle", answer: "WORDS", solvedCount: 3, responseCount: 7 };
  if (question.kind === "typed") {
    return {
      kind: "typed",
      answer: "Firstname Lastname",
      correctCount: 3,
      responseCount: 7,
      correctNames: ["Amina", "Baseer", "Chloe"],
    };
  }
  return null;
}
