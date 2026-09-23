import type { QuestionPack } from "../../definition.ts";

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
  catalogue: [],
};
