import { typedQuestion } from "../../authoring.ts";

export const commonPassword = typedQuestion({
  id: "common-password",
  title: "Create the most common password",
  prompt: "Create the most common password",
  instructions:
    "Make up a password. Match the room to score. Never use a real password.",
  scoring: "commonness",
  accepted: { known: [] },
  explanation:
    "Case and outer spaces do not matter; repeated spaces count as one. Unique answers score zero. The biggest matching group gets 100; smaller matching groups score proportionally. Ties share the same score.",
  notes:
    "Confirmed mechanic: matching other guests. NFKC text, lower case, trim and collapse whitespace. Points = round(100 × (group size − 1) / (largest group − 1)); all unique = zero. Dense frequency rank at reveal, no speed bonus. The settlement freezes at reveal and uses eligible accepted answers only.",
});
