import { typedQuestion } from "../../authoring.ts";

// Sources and accepted-name scope: docs/content/original-name-sources.md.
export const realNameVinDiesel = typedQuestion({
  id: "real-name-vin-diesel",
  presentation: "redacted-file",
  title: "Original name: Vin Diesel",
  prompt: "What was their original name? Vin Diesel",
  instructions:
    "Type their original first name and surname, then send. Middle names are optional.",
  accepted: { known: ["Mark Sinclair", "Mark Sinclair Vincent", "Mark Vincent"] },
  explanation:
    "Mark Sinclair. Even the man from Fast & Furious started out sounding like he could sort your mortgage. Mark Sinclair Vincent and Mark Vincent are also accepted as reported earlier names.",
  notes:
    "CUNY’s 2018 commencement announcement identifies Vin Diesel’s given name as Mark Sinclair. Industria’s direct interview uses Mark Sinclair Vincent; TIME’s 2015 profile records his earlier use of Mark Vincent. Accept all three for this original-name question. These are public biographical names; no assertion about a legal deed poll. Full sources: docs/content/original-name-sources.md.",
});
