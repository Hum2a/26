import type { QuestionPack } from "../../definition.ts";
import { carName } from "./car-name.ts";
import { favouriteGenre } from "./favourite-genre.ts";
import { ignoranceTriggers } from "./ignorance-triggers.ts";
import { leviticus187 } from "./leviticus-18-7.ts";
import { mockElection } from "./mock-election.ts";
import { realNameCountBinface } from "./real-name-count-binface.ts";
import { realNameTommyRobinson } from "./real-name-tommy-robinson.ts";
import { realNameZackPolanski } from "./real-name-zack-polanski.ts";
import { realNameVinDiesel } from "./real-name-vin-diesel.ts";
import { realNameJamieFoxx } from "./real-name-jamie-foxx.ts";
import { redPillBluePill } from "./red-pill-blue-pill.ts";
import { trolleyProblem } from "./trolley-problem.ts";
import { trolleyYourMum } from "./trolley-your-mum.ts";
import { trolleyMamdaniAfrica } from "./trolley-mamdani-africa.ts";
import { trolleyFreddoMultiverse } from "./trolley-freddo-multiverse.ts";
import { favouritePokemon } from "./favourite-pokemon.ts";
import { howItalianIsHumza } from "./how-italian-is-humza.ts";
import { christianityBranches } from "./christianity-branches.ts";
import { inflationFreddo } from "./inflation-freddo.ts";
import { inflationPetrol } from "./inflation-petrol.ts";
import { inflationMealDeal } from "./inflation-meal-deal.ts";
import { inflationSausageRoll } from "./inflation-sausage-roll.ts";
import { inflationCheeseburger } from "./inflation-cheeseburger.ts";
import { commonPassword } from "./common-password.ts";
import { completeAWordle } from "./complete-a-wordle.ts";
import { whoSaidItEmpathy } from "./who-said-it-empathy.ts";
import { whoSaidItFreedom } from "./who-said-it-freedom.ts";
import { whoSaidItSleep } from "./who-said-it-sleep.ts";
import { whoSaidItSalvation } from "./who-said-it-salvation.ts";
import { whoSaidItCryingCeo } from "./who-said-it-crying-ceo.ts";
import { whoSaidItNihilism } from "./who-said-it-nihilism.ts";
import { whoSaidItTechnology } from "./who-said-it-technology.ts";
import { whoSaidItPerformanceReview } from "./who-said-it-performance-review.ts";
import { whoSaidItAbsoluteForce } from "./who-said-it-absolute-force.ts";
import { whoSaidItGriefPipeline } from "./who-said-it-grief-pipeline.ts";
import { guessTabOyster } from "./guess-tab-oyster.ts";
import { guessTabCarInsurance } from "./guess-tab-car-insurance.ts";
import { guessTabSohoPint } from "./guess-tab-soho-pint.ts";
import { guessTabEvCharge } from "./guess-tab-ev-charge.ts";
import { aiTuringTest } from "./ai-turing-test.ts";
import { heathrowSearchQuery } from "./heathrow-search-query.ts";
import { rankDrivingSins } from "./rank-driving-sins.ts";
import { subcultureCheeseRollers } from "./subculture-cheese-rollers.ts";
import { subcultureGurners } from "./subculture-gurners.ts";
import { subculturePuddleStompers } from "./subculture-puddle-stompers.ts";
import { subcultureRantersMuggletonians } from "./subculture-ranters-muggletonians.ts";
import { datingExitExcuse } from "./dating-exit-excuse.ts";
import { dialPopCulture } from "./dial-pop-culture.ts";
import { dialLondonGeography } from "./dial-london-geography.ts";
import { dialBritishPolitics } from "./dial-british-politics.ts";

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
    trolleyYourMum,
    trolleyMamdaniAfrica,
    trolleyFreddoMultiverse,
    realNameCountBinface,
    realNameZackPolanski,
    realNameTommyRobinson,
    realNameVinDiesel,
    realNameJamieFoxx,
    favouritePokemon,
    commonPassword,
    completeAWordle,
    inflationFreddo,
    inflationPetrol,
    inflationMealDeal,
    inflationSausageRoll,
    inflationCheeseburger,
    howItalianIsHumza,
    christianityBranches,
    whoSaidItEmpathy,
    whoSaidItFreedom,
    whoSaidItSleep,
    whoSaidItSalvation,
    whoSaidItCryingCeo,
    whoSaidItNihilism,
    whoSaidItTechnology,
    whoSaidItPerformanceReview,
    whoSaidItAbsoluteForce,
    whoSaidItGriefPipeline,
    guessTabOyster,
    guessTabCarInsurance,
    guessTabSohoPint,
    guessTabEvCharge,
    aiTuringTest,
    heathrowSearchQuery,
    rankDrivingSins,
    subcultureCheeseRollers,
    subcultureGurners,
    subculturePuddleStompers,
    subcultureRantersMuggletonians,
    datingExitExcuse,
    dialPopCulture,
    dialLondonGeography,
    dialBritishPolitics,
  ],
};
