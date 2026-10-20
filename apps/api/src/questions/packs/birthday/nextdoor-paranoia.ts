import { choiceQuestion } from "../../authoring.ts";

export const nextdoorParanoia = choiceQuestion({
  id: "nextdoor-paranoia",
  title: "Nextdoor neighbourhood watch paranoia",
  prompt:
    "Saw a suspicious male walking at 11:14 PM wearing a dark hoodie, looking at his phone. Paused outside number 42 for 18 seconds.",
  instructions: "What was actually happening? Pick one, then send.",
  options: [
    {
      id: "deliveroo",
      label: "A Deliveroo driver trying to find the flat door",
    },
    {
      id: "pokemon",
      label: "A teenager catching a Shiny in Pokémon GO",
    },
    {
      id: "operative",
      label: "A plainclothes counter-terror operative",
    },
    {
      id: "son",
      label: "The homeowner’s own son returning from uni",
    },
  ],
  requirements: [
    {
      code: "truth",
      name: "community-source",
      detail:
        "Supply a real post or screenshot and its confirmed explanation; the example proposes A or B without a factual answer.",
    },
  ],
  notes:
    "Supplied illustrative text only. Do not fabricate a Nextdoor/local Facebook source, screenshot or real person. Redact identifying addresses/names from a supplied image.",
});
