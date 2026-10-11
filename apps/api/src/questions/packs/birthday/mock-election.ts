import { choiceQuestion } from "../../authoring.ts";

// Design brief: a ballot paper and a ballot box. The stage counts the room
// like an election night swingometer.
// An unscored poll. Polls may list up to 16 options, so every party fits.
export const mockElection = choiceQuestion({
  id: "mock-election",
  presentation: "ballot-paper",
  title: "Mock British election",
  prompt: "Mock British election: vote for a party.",
  outcome: { kind: "poll" },
  options: [
    { id: "labour", label: "Labour" },
    { id: "conservative", label: "Conservative" },
    { id: "reform", label: "Reform UK" },
    { id: "lib-dem", label: "Liberal Democrats" },
    { id: "green", label: "Green Party" },
    { id: "snp", label: "SNP" },
    { id: "plaid-cymru", label: "Plaid Cymru" },
    { id: "your-party", label: "Your Party" },
    { id: "workers-party", label: "Workers Party" },
    { id: "monster-raving", label: "Official Monster Raving Loony Party" },
    { id: "count-binface", label: "Count Binface Party" },
    { id: "dup", label: "DUP" },
    { id: "sinn-fein", label: "Sinn Féin" },
    { id: "alliance", label: "Alliance" },
    { id: "sdlp", label: "SDLP" },
    { id: "uup", label: "UUP" },
  ],
});
