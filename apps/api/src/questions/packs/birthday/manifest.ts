import { accommodation01 } from "./accommodation-01.ts";
import { edOrHumza } from "./ed-or-humza.ts";
import { accommodation02 } from "./accommodation-02.ts";
import { accommodation03 } from "./accommodation-03.ts";
import { guessemotionalsupport } from "./guess-emotional-support.ts";
import { guesscouncilcoup } from "./guess-council-coup.ts";
import { guessairportlounge } from "./guess-airport-lounge.ts";
import { apologyVideoAuction } from "./apology-video-auction.ts";
import { nextdoorParanoia } from "./nextdoor-paranoia.ts";
import { groupChatFigurine } from "./group-chat-figurine.ts";
import { cursedSearchHistory } from "./cursed-search-history.ts";
import { propertyPriceRoulette } from "./property-price-roulette.ts";
import { kartSprint } from "./kart-sprint.ts";
import { kartParkGrandPrix } from "./kart-park-grand-prix.ts";
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
import { favouritePokemon } from "./favourite-pokemon.ts";
import { whosThatPokemon } from "./whos-that-pokemon.ts";
import { howItalianIsHumza } from "./how-italian-is-humza.ts";
import { christianityBranches } from "./christianity-branches.ts";
import { inflationFreddo } from "./inflation-freddo.ts";
import { inflationPetrol } from "./inflation-petrol.ts";
import { inflationMealDeal } from "./inflation-meal-deal.ts";
import { inflationSausageRoll } from "./inflation-sausage-roll.ts";
import { inflationCheeseburger } from "./inflation-cheeseburger.ts";
import { commonPassword } from "./common-password.ts";
import { completeAWordle } from "./complete-a-wordle.ts";
import { guessTabOyster } from "./guess-tab-oyster.ts";
import { guessTabCarInsurance } from "./guess-tab-car-insurance.ts";
import { guessTabSohoPint } from "./guess-tab-soho-pint.ts";
import { guessTabEvCharge } from "./guess-tab-ev-charge.ts";
import { heathrowSearchQuery } from "./heathrow-search-query.ts";
import { rankDrivingSins } from "./rank-driving-sins.ts";
import { datingExitExcuse } from "./dating-exit-excuse.ts";
import { dialPopCulture } from "./dial-pop-culture.ts";
import { dialLondonGeography } from "./dial-london-geography.ts";
import { dialBritishPolitics } from "./dial-british-politics.ts";
import { chessBattle } from "./chess-battle.ts";
import { trumpMadeUpCountry } from "./trump-made-up-country.ts";

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
    "accommodation-01",
    "accommodation-02",
    "accommodation-03",

    "apology-video-auction",
    "favourite-genre",
    "leviticus-18-7",
    "car-name",
    "ignorance-triggers",
    "mock-election",
    "red-pill-blue-pill",
    "trolley-problem",
    "real-name-count-binface",
    "real-name-zack-polanski",
    "real-name-tommy-robinson",
    "real-name-vin-diesel",
    "real-name-jamie-foxx",
    "favourite-pokemon",
    "whos-that-pokemon",
    "common-password",
    "complete-a-wordle",
    "inflation-freddo",
    "inflation-petrol",
    "inflation-meal-deal",
    "inflation-sausage-roll",
    "inflation-cheeseburger",
    "how-italian-is-humza",
    "christianity-branches",
    "trump-made-up-country",
    "guess-tab-oyster",
    "guess-tab-car-insurance",
    "guess-tab-soho-pint",
    "guess-tab-ev-charge",
    "heathrow-search-query",
    "rank-driving-sins",
    "dating-exit-excuse",
    "dial-pop-culture",
    "dial-london-geography",
    "dial-british-politics",
    "chess-battle",
    "group-chat-figurine",
    "cursed-search-history",
    "kart-sprint",
  ],
  catalogue: withPointsTrolls([
    edOrHumza,
    accommodation01,
    accommodation02,
    accommodation03,
    guessemotionalsupport,
    guesscouncilcoup,
    guessairportlounge,

    apologyVideoAuction,
    nextdoorParanoia,
    groupChatFigurine,
    cursedSearchHistory,
    propertyPriceRoulette,

    kartSprint,
    kartParkGrandPrix,
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
    realNameVinDiesel,
    realNameJamieFoxx,
    favouritePokemon,
    whosThatPokemon,
    commonPassword,
    completeAWordle,
    inflationFreddo,
    inflationPetrol,
    inflationMealDeal,
    inflationSausageRoll,
    inflationCheeseburger,
    howItalianIsHumza,
    christianityBranches,
    guessTabOyster,
    guessTabCarInsurance,
    guessTabSohoPint,
    guessTabEvCharge,
    heathrowSearchQuery,
    rankDrivingSins,
    datingExitExcuse,
    dialPopCulture,
    dialLondonGeography,
    dialBritishPolitics,
    chessBattle,
    trumpMadeUpCountry,
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
