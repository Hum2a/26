import { choiceQuestion } from "../../authoring.ts";

export const trumpMadeUpCountry = choiceQuestion({
  id: "trump-made-up-country",
  title: "Trump's made-up countries",
  prompt: "Which of these countries has Trump made up?",
  options: [
    { id: "united-states-of-israel", label: "The United States of Israel" },
    { id: "islamic-republic-of-japan", label: "The Islamic Republic of Japan" },
    { id: "tel-aviva-la-vida", label: "Tel aviva la vida" },
    { id: "baghdaddystan", label: "Baghdaddystan" },
  ],
  // Correct option not supplied yet: left missing, so this stays a draft.
});
