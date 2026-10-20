import { choiceQuestion } from "../../authoring.ts";

export const councilFerrierSector = choiceQuestion({
  id: "council-ferrier-sector",
  title: "Council estate or dystopia: Ferrier Sector",
  prompt: "Ferrier Sector",
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
    "The user described Ferrier Sector as a former Greenwich estate. Verify this exact wording: the historical Ferrier Estate is not evidence for the word Sector. Keep the proposed name as a draft.",
  requirements: [
    {
      code: "truth",
      name: "place-source",
      detail:
        "Verify the precise estate name with a local authority or original source before marking the supplied category correct.",
    },
  ],
});
