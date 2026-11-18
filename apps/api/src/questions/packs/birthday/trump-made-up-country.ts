import { choiceQuestion } from "../../authoring.ts";

export const trumpMadeUpCountry = choiceQuestion({
  id: "trump-made-up-country",
  title: "Trump's made-up countries",
  presentation: "executive-order",
  prompt: "Which of these countries has Trump made up?",
  instructions: "Select all that apply.",
  outcome: {
    kind: "multiple",
    optionIds: ["us-of-israel", "islamic-japan"],
  },
  explanation:
    "Trump has made up the United States of Israel and the Islamic Republic of Japan. Both, and no decoys, earns 100 points.",
  notes:
    "User confirmed the first two options are correct. Exact-set scoring like christianity-branches: both without a decoy = 100, otherwise 0.",
  options: [
    { id: "us-of-israel", label: "The United States of Israel" },
    { id: "islamic-japan", label: "The Islamic Republic of Japan" },
    { id: "tel-aviva", label: "Tel aviva la vida" },
    { id: "baghdaddystan", label: "Baghdaddystan" },
  ],
});
