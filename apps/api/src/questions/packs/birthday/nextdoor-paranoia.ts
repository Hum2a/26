import { choiceQuestion } from "../../authoring.ts";

export const nextdoorParanoia = choiceQuestion({
  id: "nextdoor-paranoia",
  title: "Nextdoor neighbourhood watch paranoia",
  prompt: "What was the suspicious vehicle actually doing?",
  instructions: "Inspect the post. Pick one, then send.",
  options: [
    {
      id: "newspapers",
      label: "Delivering newspapers",
    },
    {
      id: "police",
      label: "An unmarked police tail",
    },
    {
      id: "parent",
      label: "A parent checking the school run",
    },
    {
      id: "burglary",
      label: "Casing houses for a burglary",
    },
  ],
  correctOption: {
    known: "newspapers",
  },
  media: [
    {
      name: "question",
      kind: "image",
      required: true,
      asset: "/assets/questions/nextdoor-paranoia/photo.png",
      credit:
        "Typeset reconstruction of a post quoted by Marshall News Messenger (2024)",
      alt: "A neighbourhood-app post from a neighbour",
    },
  ],
  explanation:
    "“Turned out it was the newspaper delivery guy.” Marshall News Messenger, 5 February 2024.",
  notes:
    "Column: https://marshallnewsmessenger.com/2024/02/05/look-who-is-nextdoor-a-spying-suspicious-paranoid-snoop (5 Feb 2024). No screenshot or names published. Typeset card uses only the quoted slow-moving school-bus phrase. Catalogue only until slotted.",
});
