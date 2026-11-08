import { roomPlayerLimit } from "@26/shared";
export const maxPlayers = roomPlayerLimit;
export const maxTransfers = 40;
export const maxNameReactions = 10;
export const liveSampleSize = 8;
export const maxPayloadBytes = 4096;
export const transferTtlMs = 120 * 1000;
export const pinnedQuestionSetVersion = "unreleased";
export const pinnedScoringVersion = "unreleased";
export const demoQuestionSetVersion = "demo-2026-09-22";
export const multipleChoiceScoringVersion = "mc-v1";

export const nicknameTakenMessage =
  "That nickname is already in this room. Choose another.";
export const roomFullMessage = "This room is full.";
export const digestMismatchMessage =
  "That request was already saved with different details.";
export const roomMissingMessage = "This room does not exist.";
export const transferExpiredMessage = "That transfer code has expired.";
export const transferUsedMessage = "That transfer code has already been used.";
export const transferInvalidMessage = "That transfer code was not accepted.";
export const messageLimitMessage =
  "Too many taps at once. Wait a moment and try again.";
export const transferLimitMessage = "This room has issued too many transfers.";
export const playerMissingMessage = "That player is not in this room.";
export const roundStartMessage = "A round can only start from the lobby.";
export const answerLateMessage = "That answer is too late.";
export const answerClosedMessage = "This phase is not accepting answers.";
export const answerPausedMessage = "The game is paused.";
export const answerHeldMessage = "Waiting for the host.";
export const answerDuplicateMessage = "This phone already answered this phase.";
export const answerUnknownMessage = "That option is not on this question.";
export const contentUnavailableMessage =
  "This room's question version is not available.";
export const answerRoleMessage = "This screen cannot answer.";
export const controlMissingMessage = "This screen needs its room session.";
export const skipClosedMessage = "This question cannot be skipped.";
export const finishClosedMessage = "This quiz cannot be finished from here.";
export const endNowClosedMessage = "There is no game running to end.";
export const roomDestroyedMessage = "The host closed this room.";
export const finishAfterMessage = "The quiz will finish after this question.";
export const reactionLimitMessage = "You have used all 10 name votes.";
export const reactionSelfMessage = "You cannot vote on your own name.";
export const reactionClosedMessage = "Name votes are closed.";
export const adjustmentReasonMessage = "Enter a reason of 3 to 80 characters.";
export const playerActiveMessage = "That player is already in the game.";
export const hideClosedMessage = "The stage can be hidden during a reveal.";
export const namesClosedMessage = "Nicknames can be revealed from the lobby.";
export const revealClosedMessage = "This question cannot be shown again yet.";
export const estimateInvalidMessage = "Enter a number on this scale.";
export const estimateStepMessage = "That estimate does not match the step.";
export const estimateClosedMessage = "This question is not an estimate.";
export const rankClosedMessage = "This question is not a ranking.";
export const rankDuplicateMessage = "Each item can be placed once.";
export const rankMissingMessage = "Place every item before sending.";
export const rankUnknownMessage = "That item is not on this question.";
export const rankTieMessage = "Each position can hold one item.";
export const rankPartialMessage = "Place at least one item.";
export const textInvalidMessage = "Write an answer of 1 to 80 characters.";
export const textClosedMessage = "This question is not collecting written answers.";
export const typedInvalidMessage = "Type an answer that fits the box.";
export const moderationClosedMessage =
  "Answers can be hidden while they are collected or voted on. Hide the stage instead.";
export const moderationFlowMessage =
  "This vote runs in rounds. Hide answers before voting starts, or hide the stage.";
export const moderationNotShownMessage =
  "This question does not show written answers on the big screen.";
/** A written answer with an identity slur. The text is never echoed back. */
export const answerBlockedMessage =
  "That answer can't go on the big screen. Try different wording.";
export const ballotClosedMessage = "This question is not collecting votes.";
export const ballotUnknownMessage = "That answer is not on the ballot.";
export const ballotSelfMessage = "You cannot vote for your own answer.";
export const ballotWithdrawnMessage = "That answer has left the ballot.";
export const ballotLateJoinMessage = "You joined too late to vote in this round.";
export const shortlistClosedMessage = "The ballot is already frozen.";
export const shortlistMissingMessage = "That answer is not in this round.";
export const featureClosedMessage = "The stage selection is closed.";
export const featureLimitMessage = "The stage can feature 8 answers.";
export const duelInvalidMessage = "Send a number on the scale.";
export const duelStepMessage = "That number is not on the step.";
export const duelClosedMessage = "This duel is not accepting numbers.";
export const duelLateMessage = "You joined too late for this duel.";
export const duelRoleMessage = "You are not playing this duel.";
export const predictionClosedMessage = "Predictions are closed.";
export const predictionContestantMessage =
  "Contestants play the duel. They do not back a winner.";
export const predictionUnknownMessage = "That player is not in this duel.";
export const demoScoringVersion = "demo-rounds-v4";
export const trollLockedMessage = "Trolls unlock on the second question.";
export const trollSpentMessage = "You have used your troll.";
export const trollKindMessage = "That troll is not in this game.";
export const trollSwitchedOffMessage = "The host has switched that troll off.";
export const trollQuestionMessage = "That troll does nothing on this question.";
export const trollPhotoMessage = "They have no photo to zoom into yet.";
export const sampleRoomBusyMessage =
  "Sample data only goes into an empty room. Create a new lobby and fill that one.";
export const trollPhaseMessage = "That troll cannot start in this phase.";
export const trollSelfMessage = "Choose another player.";
export const trollTargetMessage = "That player is not in this room.";
export const trollSlotMessage = "That phone already has a troll waiting.";
export const trollModifierMessage = "This question does not allow that score change.";
export const trollEscapeMessage = "That troll cannot be dismissed.";
export const trollMissingMessage = "That troll is not running.";
export const trollAttributionMessage = "This question does not show live drafts.";
export const trollVoiceMessage = "Send a checked voice clip before this troll.";
export const mediaUrlMs = 5 * 60 * 1000;
export const mediaLeaseMs = 30 * 1000;
export const acceptedImageBytes = 1_048_576;
export const temporaryPhotoBytes = 8 * 1_048_576;
export const photoEdgePx = 1280;
export const voiceMaxBytes = 400_000;
export const voiceMaxMs = 3_000;
export const playerMediaSlots = 8;
export const roomMediaSlots = 80;
/** Driver face photos, counted apart from question media. Retakes are expected. */
export const playerFaceSlots = 5;
export const roomFaceSlots = 400;
export const faceQuotaMessage = "You have used your driver photo retakes.";

/** Photo wall. See `docs/photo-wall-plan.md`. */
export const playerWallSlots = 15;
export const roomWallSlots = 250;
export const wallCooldownMs = 45_000;
export const wallWaitingPerPlayer = 3;
export const wallQuotaMessage = "You have sent all your photos for tonight.";
export const wallRoomQuotaMessage = "The photo wall is full for tonight.";
export const wallCooldownMessage =
  "Give everyone else a turn. You can send another photo shortly.";
export const wallWaitingMessage =
  "You already have photos waiting. Send another once one is shown.";
export const wallClosedMessage = "The photo wall is switched off right now.";
export const wallMutedMessage = "The host has paused your photos.";
export const wallMediaMessage = "Send that photo again.";
export const wallSentMessage = "That photo is already on its way.";
export const wallPostMissingMessage = "That photo is no longer on the wall.";
export const wallFrameMessage = "Choose one of the frames.";
export const wallDecidedMessage = "That photo has already been dealt with.";
export const wallNothingShowingMessage = "Nothing is on the photo wall right now.";
export const wallSettingsMessage = "Those photo wall settings were not accepted.";
export const wallReactionsPerPhoto = 20;
export const wallReactionGapMs = 300;
export const wallReactionClosedMessage = "That photo has left the screen.";
export const wallReactionLimitMessage = "That's plenty of love for one photo.";
export const wallShowMsMin = 4_000;
export const wallShowMsMax = 20_000;
export const driverStyleMessage = "That driver is not in this game.";
export const driverFaceMessage = "That photo is not your driver photo.";
export const driverClosedMessage = "Drivers can be changed before the podium.";
export const mediaClosedMessage = "Media uploads open once a question is running.";
export const mediaQuotaMessage = "You have used your media uploads for this game.";
export const mediaRoomQuotaMessage = "This room has reached its media limit.";
export const mediaOwnerMessage = "That upload belongs to another phone.";
export const mediaMissingMessage = "That upload is not in this room.";
export const mediaLateMessage = "This round closed before the media was kept.";
export const mediaChangedMessage = "The upload changed. Send it again.";
export const mediaLargeMessage = "That file is too large.";
export const mediaTypeMessage = "That file is not media this game can keep.";
export const mediaVoiceMessage = "That voice clip must be a WAV of 3 seconds or less.";
export const mediaHeicMessage =
  "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.";
export const mediaBusyMessage = "That upload is already being checked.";
export const mediaExpiredMessage = "That upload link has expired.";
export const mediaConfigMessage =
  "Photo processing is not configured for this environment.";
export const mediaAttemptMessage = "That upload could not be checked again.";

export function isLocalApp(appEnv: string): boolean {
  return appEnv === "local";
}
