import type { QuestionPack } from "../../definition.ts";
import { carName } from "./car-name.ts";
import { favouriteGenre } from "./favourite-genre.ts";
import { ignoranceTriggers } from "./ignorance-triggers.ts";
import { leviticus187 } from "./leviticus-18-7.ts";
import { mockElection } from "./mock-election.ts";
import { realNameCountBinface } from "./real-name-count-binface.ts";
import { realNameTommyRobinson } from "./real-name-tommy-robinson.ts";
import { realNameZackPolanski } from "./real-name-zack-polanski.ts";
import { redPillBluePill } from "./red-pill-blue-pill.ts";
import { trolleyProblem } from "./trolley-problem.ts";
import { favouritePokemon } from "./favourite-pokemon.ts";
import { howItalianIsHumza } from "./how-italian-is-humza.ts";
import { christianityBranches } from "./christianity-branches.ts";
import { inflationFreddo } from "./inflation-freddo.ts";
import { inflationPetrol } from "./inflation-petrol.ts";
import { commonPassword } from "./common-password.ts";
import { completeAWordle } from "./complete-a-wordle.ts";

/**
 * Working catalogue for Humza's questions.
 * `birthday-draft` is not a playable version. Rooms keep the version they started with.
 * Add a question file, then list it in `catalogue`. Leave `order` empty until it is ready
 * and you explicitly want it in a running order. Releasing a version is a separate step.
 */
export const birthdayPack: QuestionPack = {
  packId: "birthday",
  version: "birthday-draft",
  release: "draft",
  profile: "party",
  illustrative: false,
  order: [],
  catalogue: [
    favouriteGenre,
    leviticus187,
    carName,
    ignoranceTriggers,
    mockElection,
    redPillBluePill,
    trolleyProblem,
    realNameCountBinface,
    realNameZackPolanski,
    realNameTommyRobinson,
    favouritePokemon,
    commonPassword,
    completeAWordle,
    inflationFreddo,
    inflationPetrol,
    howItalianIsHumza,
    christianityBranches,
  ],
};
