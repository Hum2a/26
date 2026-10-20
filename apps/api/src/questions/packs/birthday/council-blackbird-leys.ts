import { choiceQuestion } from "../../authoring.ts";

export const councilBlackbirdLeys = choiceQuestion({
  id: "council-blackbird-leys",
  title: "Council estate or dystopia: Blackbird Leys",
  prompt: "Blackbird Leys",
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
  correctOption: {
    known: "council",
  },
  explanation:
    "A real Oxford estate. Blackbird Leys sounds like a faction you unlock after the tutorial, but it has a parish council.",
  notes:
    "Primary sources: Oxford City Council park description, https://www.oxford.gov.uk/directory-record/44/blackbird-leys-park ; Blackbird Leys Parish Council history, https://www.blackbirdleysparishcouncil.gov.uk/copy-of-news . Exact estate name confirmed.",
});
