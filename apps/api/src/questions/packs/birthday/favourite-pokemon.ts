import { choiceQuestion } from "../../authoring.ts";

export const favouritePokemon = choiceQuestion({
  id: "favourite-pokemon",
  title: "Favourite Pokémon",
  prompt: "Favourite Pokémon",
  options: [
    {
      id: "turtwig",
      label: "Turtwig",
      image: "/assets/questions/favourite-pokemon/turtwig.png",
    },
    {
      id: "mudkip",
      label: "Mudkip",
      image: "/assets/questions/favourite-pokemon/mudkip.png",
    },
    {
      id: "tepig",
      label: "Tepig",
      image: "/assets/questions/favourite-pokemon/tepig.png",
    },
    {
      id: "osama-bin-laden",
      label: "Osama bin laden",
      image: "/assets/questions/favourite-pokemon/osama-bin-laden.png",
    },
  ],
  correctOption: { known: "mudkip" },
});
