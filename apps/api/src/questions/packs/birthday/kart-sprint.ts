import { kartQuestion } from "../../authoring.ts";

export const kartSprint = kartQuestion({
  id: "kart-sprint",
  trackId: "mario-circuit-v1",
  title: "The 26 Grand Prix: one-lap sprint",
  prompt: "One lap. three minutes. Who can actually drive?",
  instructions:
    "Race on your phone held sideways. Slide the pad to steer, push up to accelerate, pull down to brake and hold R to drift. The big screen shows the live map and race order.",
  explanation:
    "Fastest completed lap wins. Finishers share place on equal server times; DNF scores zero. Ghost karts mean nobody can blame traffic.",
  notes:
    "Mario-kart-js driving model ported to a pure server reducer with a imported Mario circuit. Server owns inputs, physics, eight ordered gates, lap time and three-minute cutoff. Up to 80 participants freeze at intro, with the highest current score at the front and joining order breaking ties. Ranking points: round(100 × (participants - place + 1) / participants), finishers only. No client lap-time submission or second socket. See docs/kart-minigame.md.",
});
