/**
 * Illustrative demo pack. Question files live in `packs/demo`.
 * This module re-exports them so existing imports keep one source.
 * Guest JavaScript must not import it.
 */
export {
  demoAnswerKeyMarker,
  assertCollectWindow,
  type AttributionMode,
  type ChoiceQuestion,
  type DuelQuestion,
  type FinaleQuestion,
  type GuessQuestion,
  type Question as DemoQuestion,
  type RankPlacement,
  type RankQuestion,
  type SliderBand,
  type SliderQuestion,
  type VoteQuestion,
} from "./definition.ts";
export { demoCollectWindows, demoQuestionAt, demoQuestions } from "./registry.ts";
