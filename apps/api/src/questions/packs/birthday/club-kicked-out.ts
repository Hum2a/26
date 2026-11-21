import { choiceQuestion } from "../../authoring.ts";

export const clubKickedOut = choiceQuestion({
  id: "club-kicked-out",
  title: "Kicked out of a club",
  prompt: "Humza's been kicked out of a club 1 time in his life, what was the reason?",
  instructions: "Pick one, then send.",
  options: [
    { id: "mistaken", label: "They mistook him for someone else" },
    {
      id: "welfare",
      label:
        'A femboy welfare officer saw him throw up and decided he needed "medical help"',
    },
    {
      id: "elbow",
      label: "He unapologetically elbowed a midget who punched him first",
    },
    {
      id: "beer-hat",
      label: "He filled a jews hat with beer and called him a pissraeli",
    },
  ],
  correctOption: { known: "elbow" },
  explanation: "He unapologetically elbowed a midget who punched him first.",
  notes:
    'Question, options and answer supplied by Humza, 21 November 2026; wording preserved except the welfare option, where "medical assistance" became "medical help" to fit the 80-character option limit.',
});
