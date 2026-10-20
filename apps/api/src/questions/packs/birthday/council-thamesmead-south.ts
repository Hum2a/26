import { choiceQuestion } from "../../authoring.ts";

export const councilThamesmeadSouth = choiceQuestion({
  id: "council-thamesmead-south",
  title: "Council estate or dystopia: Thamesmead South",
  prompt: "Thamesmead South",
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
    "A real part of Thamesmead’s housing estate. South Thamesmead is the usual current name; Thamesmead South also appears in council planning documents.",
  notes:
    "Bexley adopted Thamesmead/Abbey Wood SPD, Dec 2009, uses Thamesmead South: https://www.bexley.gov.uk/sites/default/files/2020-05/Thamesmead-and-Abbey-Wood-SPD-Main-December-2009.pdf . Peabody confirms South Thamesmead: https://www.thamesmeadnow.org.uk/explore/new-improved-buildings/south-thamesmead/ . No unverified film-location claim included.",
});
