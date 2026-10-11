import { choiceQuestion } from "../../authoring.ts";

// Design brief: a music-player look. Each option is a track with its own
// sleeve, and the reveal plays the winner.
export const favouriteGenre = choiceQuestion({
  id: "favourite-genre",
  presentation: "now-playing",
  title: "Favourite genre",
  prompt: "What is my favourite genre of music?",
  options: [
    { id: "white-girl", label: "White girl bangers" },
    { id: "persona", label: "Persona music" },
    { id: "flute", label: "Shitty flute remixes on YouTube" },
    { id: "goat", label: "Screaming goat sounds" },
  ],
  correctOption: { known: "white-girl" },
});
