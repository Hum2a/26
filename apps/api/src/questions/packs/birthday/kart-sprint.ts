import { kartQuestion } from "../../authoring.ts";

export const kartSprint = kartQuestion({
  id: "kart-sprint",
  title: "The 26 Grand Prix: one-lap sprint",
  prompt: "One lap. 45 seconds. Who can actually drive?",
  instructions:
    "Your phone is the controller. Hold A to accelerate, steer around the clockwise circuit, B to brake and R to drift. Watch your numbered kart on the TV.",
  explanation:
    "Fastest completed lap wins. Finishers share place on equal server times; DNF scores zero. Ghost karts mean nobody can blame traffic.",
  notes:
    "Mario-kart-js driving model ported to a pure server reducer with a procedural party circuit. Server owns inputs, physics, eight ordered gates, lap time and 45-second cutoff. Participants freeze at intro. Ranking points: round(100 × (participants - place + 1) / participants), finishers only. No client lap-time submission or second socket. See docs/kart-minigame.md.",
});
