import { choiceQuestion } from "../../authoring.ts";

export const councilRedoubtNewBabylon = choiceQuestion({
  id: "council-redoubt-new-babylon",
  title: "Council estate or dystopia: The Redoubt of New Babylon",
  prompt: "The Redoubt of New Babylon",
  instructions: "UK council estate or sci-fi dystopian faction? Pick one, then send.",
  options: [
    {
      id: "council",
      label: "Council estate",
    },
    {
      id: "dystopia",
      label: "Dystopia",
    },
  ],
  notes:
    "User-supplied category example. Research the exact name, not a similar place. The supplied Redoubt name is treated as invented fiction, not attributed to an existing franchise.",
  correctOption: {
    known: "dystopia",
  },
  explanation:
    "An invented dystopian name from the question brief. No council has yet admitted to naming an estate this dramatically.",
});
