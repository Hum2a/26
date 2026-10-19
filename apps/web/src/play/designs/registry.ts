import type { CustomPresentationId } from "@26/shared";
import type { QuestionPresentation } from "../presentation";
import { Glyph } from "./glyph";
import { BallotPaper } from "./ballot-paper";
import { BinUnmasked } from "./bin-unmasked";
import { DeedPoll } from "./deed-poll";
import { NowPlaying } from "./now-playing";
import { NumberPlate } from "./number-plate";
import { RageMeter } from "./rage-meter";
import { RedBluePill } from "./red-blue-pill";
import { RedactedFile } from "./redacted-file";
import { Scripture } from "./scripture";
import { TrolleyLever } from "./trolley-lever";

/** One design per custom presentation id. A missing id fails the typecheck. */
export const designs: Record<CustomPresentationId, QuestionPresentation> = {
  glyph: Glyph,
  "now-playing": NowPlaying,
  scripture: Scripture,
  "number-plate": NumberPlate,
  "rage-meter": RageMeter,
  "ballot-paper": BallotPaper,
  "red-blue-pill": RedBluePill,
  "trolley-lever": TrolleyLever,
  "bin-unmasked": BinUnmasked,
  "deed-poll": DeedPoll,
  "redacted-file": RedactedFile,
};
