import { choiceQuestion } from "../../authoring.ts";

export const whosThatPokemon = choiceQuestion({
  id: "whos-that-pokemon",
  title: "Who’s that Pokémon?",
  prompt: "Who’s that Pokémon?",
  presentation: "whos-that-pokemon",
  attribution: "after",
  options: [
    {
      id: "jigglypuff",
      label: "Jigglypuff",
      image: "/assets/questions/whos-that-pokemon/jigglypuff.png",
    },
    {
      id: "clefairy",
      label: "Clefairy",
      image: "/assets/questions/whos-that-pokemon/clefairy.png",
    },
    {
      id: "wigglytuff",
      label: "Wigglytuff",
      image: "/assets/questions/whos-that-pokemon/wigglytuff.png",
    },
    {
      id: "chansey",
      label: "Chansey",
      image: "/assets/questions/whos-that-pokemon/chansey.png",
    },
  ],
  correctOption: {
    known: "jigglypuff",
  },
  media: [
    {
      name: "silhouette",
      kind: "image",
      required: true,
      asset: "/assets/questions/whos-that-pokemon/silhouette.svg",
    },
  ],
  explanation: "It’s Jigglypuff!",
  notes:
    "Completed 16 November 2026 with Jigglypuff and three pink Pokémon decoys. Artwork: PokeAPI/sprites official-artwork; separate silhouette from dream-world/39.svg with vector fills and strokes blackened and descriptive metadata removed. Pokémon artwork © Nintendo/Creatures/GAME FREAK. https://github.com/PokeAPI/sprites",
});
