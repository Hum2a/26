import { kartQuestion } from "../../authoring.ts";

/**
 * The kart-sprint round on the original 26 Park course instead of the
 * imported circuit. Same rules, timing and scoring; swap it into `order` in
 * place of `kart-sprint` to use it.
 */
export const kartParkGrandPrix = kartQuestion({
  id: "kart-park-grand-prix",
  trackId: "26-park-v1",
  title: "The 26 Grand Prix: 26 Park",
  prompt: "One lap of 26 Park. Three minutes. Who can actually drive?",
  instructions:
    "Race on your phone held sideways. Slide the pad to steer, push up to accelerate, pull down to brake and hold R to drift. The big screen shows the live map and race order.",
  explanation:
    "Fastest completed lap wins. Finishers share place on equal server times; DNF scores zero. Ghost karts mean nobody can blame traffic.",
  notes:
    "Same server-owned race as kart-sprint (inputs, physics, ordered gates, lap time and three-minute cutoff), on the original 26 Park course. Ranking points: round(100 × (participants - place + 1) / participants), finishers only. See docs/kart-minigame.md.",
});
