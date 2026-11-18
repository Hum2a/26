import { choiceQuestion } from "../../authoring.ts";

/**
 * Seven options, as supplied. Option B keeps its run of spaces with
 * non-breaking spaces, because a browser collapses ordinary spaces and B
 * would then look exactly like A. Option C is the empty tag: a label cannot be
 * empty, so it uses U+3164 (Hangul filler), which renders as blank space.
 */
export const esportsTag = choiceQuestion({
  id: "esports-tag",
  title: "Humza's esports tag",
  prompt: "What was Humza's longest running official tag when competing in esports?",
  options: [
    { id: "brackets", label: "[ ]" },
    { id: "wide-brackets", label: "[           ]" },
    { id: "invisible", label: "ㅤ" },
    { id: "blank", label: "Blank" },
    { id: "humza", label: "Humza" },
    { id: "french-conn", label: "French Connections" },
    { id: "quacks", label: "Quacks" },
  ],
  correctOption: { known: "invisible" },
  explanation:
    "Option C: a completely empty tag. Not the brackets, not the word Blank. Nothing at all.",
  notes:
    "User supplied the seven options and confirmed C is correct (18 November 2026). C is an empty tag, shown with an invisible character; B's spaces are non-breaking so it stays wider than A.",
});
