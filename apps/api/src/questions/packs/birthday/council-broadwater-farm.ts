import { choiceQuestion } from "../../authoring.ts";

export const councilBroadwaterFarm = choiceQuestion({
  id: "council-broadwater-farm",
  title: "Council estate or dystopia: Broadwater Farm",
  prompt: "Broadwater Farm",
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
    "It’s a real housing estate in Tottenham. The council paperwork is real; the dystopian energy is just architecture.",
  notes:
    "Primary source: Haringey Council, Broadwater Farm estate designs and landlord offer, https://www.minutes.haringey.gov.uk/mgAi.aspx?ID=70587 . Confirms the exact estate name.",
});
