import { tribunalReddit } from "./tribunal-reddit.ts";
import { councilBroadwaterFarm } from "./council-broadwater-farm.ts";
import { councilRedoubtNewBabylon } from "./council-redoubt-new-babylon.ts";
import { councilFerrierSector } from "./council-ferrier-sector.ts";
import { councilThamesmeadSouth } from "./council-thamesmead-south.ts";
import { councilBlackbirdLeys } from "./council-blackbird-leys.ts";
import { apologyVideoAuction } from "./apology-video-auction.ts";
import { nextdoorParanoia } from "./nextdoor-paranoia.ts";
import { groupChatFigurine } from "./group-chat-figurine.ts";
import { cursedSearchHistory } from "./cursed-search-history.ts";
import { propertyPriceRoulette } from "./property-price-roulette.ts";
import { kartSprint } from "./kart-sprint.ts";
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
 * Add new questions to `catalogue` as drafts. The default order includes completed
 * rounds with kart last. Admin saves an override for new games; starting a birthday
 * game freezes its server-side script under a content hash.
 */
export const birthdayPack: QuestionPack = {
  packId: "birthday",
  version: "birthday-draft",
  release: "draft",
  profile: "party",
  illustrative: false,
  order: [
    "council-broadwater-farm",
    "council-redoubt-new-babylon",
    "council-thamesmead-south",
    "council-blackbird-leys",
    "apology-video-auction",
    "favourite-genre",
    "leviticus-18-7",
    "car-name",
    "ignorance-triggers",
    "mock-election",
    "red-pill-blue-pill",
    "trolley-problem",
    "trolley-your-mum",
    "trolley-mamdani-africa",
    "trolley-freddo-multiverse",
    "real-name-count-binface",
    "real-name-zack-polanski",
    "real-name-tommy-robinson",
    "real-name-vin-diesel",
    "real-name-jamie-foxx",
    "favourite-pokemon",
    "common-password",
    "complete-a-wordle",
    "inflation-freddo",
    "inflation-petrol",
    "inflation-meal-deal",
    "inflation-sausage-roll",
    "inflation-cheeseburger",
    "how-italian-is-humza",
    "christianity-branches",
    "who-said-it-empathy",
    "who-said-it-freedom",
    "who-said-it-sleep",
    "who-said-it-salvation",
    "who-said-it-crying-ceo",
    "who-said-it-nihilism",
    "who-said-it-technology",
    "who-said-it-performance-review",
    "who-said-it-absolute-force",
    "who-said-it-grief-pipeline",
    "guess-tab-oyster",
    "guess-tab-car-insurance",
    "guess-tab-soho-pint",
    "guess-tab-ev-charge",
    "ai-turing-test",
    "heathrow-search-query",
    "rank-driving-sins",
    "subculture-cheese-rollers",
    "subculture-gurners",
    "subculture-puddle-stompers",
    "subculture-ranters-muggletonians",
    "dating-exit-excuse",
    "dial-pop-culture",
    "dial-london-geography",
    "dial-british-politics",
    "kart-sprint",
  ],
  catalogue: withPointsTrolls([
    tribunalReddit,
    councilBroadwaterFarm,
    councilRedoubtNewBabylon,
    councilFerrierSector,
    councilThamesmeadSouth,
    councilBlackbirdLeys,
    apologyVideoAuction,
    nextdoorParanoia,
    groupChatFigurine,
    cursedSearchHistory,
    propertyPriceRoulette,

    kartSprint,
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
  ]),
};

/**
 * The points trolls (Steal, Robin Hood, Shared score) are allowed on every
 * scored choice question, chosen by the user on 2 November 2026. A question
 * that names its own `modifiers` keeps them; polls and threshold choices are
 * left alone because they have no right answer to settle against.
 */
function withPointsTrolls(
  catalogue: QuestionPack["catalogue"],
): QuestionPack["catalogue"] {
  return catalogue.map((question) =>
    question.kind === "choice" &&
    question.outcome.kind === "correct" &&
    question.modifiers === undefined
      ? { ...question, modifiers: ["steal", "robin-hood", "share"] as const }
      : question,
  );
}
