import { sliderQuestion } from "../../authoring.ts";

export const guessTabOyster = sliderQuestion({
  id: "guess-tab-oyster",
  title: "Guess the Tab: TfL Oyster fare",
  prompt:
    "Adult peak PAYG single: Sutton → Oxford Circus via Zone 1. TfL default route, October 2026.",
  instructions:
    "Enter a price in pounds. Closest without going over wins. Ties share the win; all over means no winner.",
  scoring: "under",
  input: "number",
  minimum: 0,
  maximum: 30,
  step: 0.01,
  initial: 0,
  unit: "£",
  truth: {
    known: 8.8,
  },
  explanation:
    "TfL lists £8.80 for the adult peak default route. A different interchange route can cost less; this question uses the named default, not every possible route.",
  notes:
    "TfL API /StopPoint/910GSUTTON/FareTo/940GZZLUOXC checked 20 Oct 2026. Adult default-route PAYG peak £8.80; current dates 5 Jul 2026–5 Jul 2027. Alternative-route peak £7.70 is a different fare. Corrected Tube-only shorthand: Sutton is National Rail.",
});
