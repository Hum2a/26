import type { RoomPhaseName } from "@26/shared";
import type { PlayAction } from "../live/room-api";

export function playNotice(action: PlayAction, phase: RoomPhaseName): string {
  if (action === "start-birthday") return "The birthday game has started with its saved running order.";
  if (action === "kart-course-on") return "Floor boosts, ramps and sweepers are on.";
  if (action === "kart-course-off")
    return "Course features are off. Airborne karts have landed.";
  if (action === "start") {
    return "The illustrative demo has started.";
  }
  if (action === "pause") {
    return "The quiz is paused.";
  }
  if (action === "troll-on") {
    return "That troll is switched on for this room.";
  }
  if (action === "troll-off") {
    return "That troll is switched off for this room.";
  }
  if (action === "wall-approve") {
    return "Approved. It joins the photo wall queue.";
  }
  if (action === "wall-decline") {
    return "Declined. The guest will see it was not shown.";
  }
  if (action === "wall-pull") {
    return "Pulled from the photo wall and hidden everywhere.";
  }
  if (action === "wall-skip") {
    return "Skipped to the next photo.";
  }
  if (action === "wall-next") {
    return "The next photo is on the wall.";
  }
  if (action === "wall-settings") {
    return "Photo wall settings saved.";
  }
  if (action === "wall-mute") {
    return "That guest can no longer send photos. Their waiting photos were declined.";
  }
  if (action === "wall-unmute") {
    return "That guest can send photos again.";
  }
  if (action === "resume") {
    return "The quiz has resumed.";
  }
  if (action === "skip") {
    return "The question was skipped.";
  }
  if (action === "advance" && phase === "facts") {
    return "The next fact is on the stage.";
  }
  if (action === "advance" && phase === "podium") {
    return "The podium is up.";
  }
  if (action === "finish") {
    return phase === "podium"
      ? "The quiz is finished."
      : "The quiz will finish after this question.";
  }
  if (action === "reveal-names") {
    return "The nickname votes are on the stage. They do not change the scores.";
  }
  if (action === "hide") {
    return "The stage content is hidden.";
  }
  if (action === "hide-media") {
    return "That photo or voice clip is hidden from the stage and the gallery.";
  }
  if (action === "show") {
    return "The stage content is visible.";
  }
  if (action === "rereveal") {
    return "The reveal is showing again. Scores were not added again.";
  }
  if (action === "rename") {
    return "The nickname was changed. The player id is the same.";
  }
  if (action === "swap") {
    return "The nicknames were swapped. The player ids are the same.";
  }
  if (action === "kick") {
    return "That phone was removed. Its old session cannot reconnect.";
  }
  if (action === "recover") {
    return "Recovery code ready in the player details. Their old phone stays signed out.";
  }
  if (action === "adjust") {
    return "The score was adjusted. The reason stays on this screen.";
  }
  if (action === "include") {
    return "That answer is on the ballot.";
  }
  if (action === "exclude") {
    return "That answer was taken off the ballot.";
  }
  if (action === "feature") {
    return "The stage selection changed. The vote tally did not.";
  }
  if (action === "retry-archive") {
    return "The archive export will try again. The podium stays up.";
  }
  if (action === "release-stuck-media") {
    return "Stuck photo and voice checks were released. Ask the guest to send the file again.";
  }
  if (action === "retry-delivery") {
    return "Waiting email jobs were tried again. Addresses stay on the delivery record.";
  }
  return `The room is on ${phase}.`;
}
