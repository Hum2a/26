import { typedQuestion } from "../../authoring.ts";

// Sources and accepted-name scope: docs/content/original-name-sources.md.
export const realNameJamieFoxx = typedQuestion({
  id: "real-name-jamie-foxx",
  presentation: "redacted-file",
  title: "Original name: Jamie Foxx",
  prompt: "What was their original name? Jamie Foxx",
  instructions:
    "Type their original first name and surname, then send. Middle names are optional.",
  accepted: { known: ["Eric Marlon Bishop", "Eric Bishop"] },
  explanation:
    "Eric Marlon Bishop — Eric Bishop is enough. Jamie Foxx sounds like a headliner; Eric Bishop sounds like he has the village hall keys.",
  notes:
    "Biography.com identifies his full birth name as Eric Marlon Bishop. In an Irish Times interview (Charm skool, 20 May 2006), Foxx describes switching from Eric Bishop to Jamie Foxx for stand-up. Accept first name plus surname, or the full name. The usual typo matcher also tolerates Marlin in the Tim Ferriss transcript. Stage-name history, not a claim about legal paperwork. Sources: docs/content/original-name-sources.md.",
});
