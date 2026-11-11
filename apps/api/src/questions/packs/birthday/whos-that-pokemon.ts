import { choiceQuestion } from "../../authoring.ts";

// Draft: the four similar-looking Pokémon and the answer have not been chosen.
// Assets live in `apps/web/public/assets/questions/whos-that-pokemon/`:
// `silhouette.png` (the blacked-out answer, shown while answers are open) and
// one colour PNG per option, named by option id, set as that option's `image`.
// The design shows option pictures only at the reveal.
export const whosThatPokemon = choiceQuestion({
  id: "whos-that-pokemon",
  title: "Who's that Pokémon?",
  prompt: "Who's that Pokémon?",
  presentation: "whos-that-pokemon",
  media: [{ name: "silhouette", kind: "image", required: true }],
  requirements: [
    {
      code: "options",
      name: "Four similar-looking Pokémon",
      detail:
        "Choose the four similar-looking Pokémon, which one is the answer, and supply a colour PNG of each plus the blacked-out silhouette.",
    },
  ],
});
