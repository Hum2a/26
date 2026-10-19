import { choiceQuestion } from "../../authoring.ts";

export const favouritePokemon = choiceQuestion({
  id: "favourite-pokemon",
  title: "Favourite Pokémon",
  prompt: "Favourite Pokémon",
  options: [
    { id: "turtwig", label: "Turtwig" },
    { id: "mudkip", label: "Mudkip" },
    { id: "tepig", label: "Tepig" },
    { id: "osama-bin-laden", label: "Osama bin laden" },
  ],
  correctOption: { known: "mudkip" },
});
