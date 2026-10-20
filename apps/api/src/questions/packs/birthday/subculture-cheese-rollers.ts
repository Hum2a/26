import { choiceQuestion } from "../../authoring.ts";

export const subcultureCheeseRollers = choiceQuestion({
  id: "subculture-cheese-rollers",
  title: "Real British subculture: The Rollers",
  prompt:
    "‘The Rollers’: people who race cheese down Cooper's Hill. Is the activity real or made up?",
  instructions: "Pick Real or Made up, then send.",
  options: [
    { id: "real", label: "Real" },
    { id: "made-up", label: "Made up" },
  ],
  correctOption: { known: "real" },
  explanation:
    "Real — Cooper’s Hill hosts cheese-rolling races. ‘The Rollers’ is quiz shorthand here, rather than the verified name of an organised club.",
  notes:
    "The activity, not a formal group named The Rollers, is being tested. Source: event media page https://www.cheese-rolling.co.uk/media_press.html and Visit Gloucester’s January 2026 Cooper’s Hill guide. User supplied Real. See docs/content/party-concepts.md.",
});
