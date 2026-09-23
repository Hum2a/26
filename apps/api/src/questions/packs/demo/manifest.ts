import type { QuestionPack } from "../../definition.ts";
import { candles } from "./candles.ts";
import { clash } from "./clash.ts";
import { colour } from "./colour.ts";
import { finale } from "./finale.ts";
import { letters } from "./letters.ts";
import { lineup } from "./lineup.ts";
import { picks } from "./picks.ts";
import { shape } from "./shape.ts";
import { toast } from "./toast.ts";
import { who } from "./who.ts";

/**
 * Released illustrative pack. Do not edit these questions in place once a room
 * has stored `demo-2026-09-22`. A change needs a new version id.
 */
export const demoPack: QuestionPack = {
  packId: "demo",
  version: "demo-2026-09-22",
  release: "released",
  profile: "illustrative",
  illustrative: true,
  order: [
    "shape",
    "colour",
    "candles",
    "letters",
    "lineup",
    "toast",
    "picks",
    "who",
    "clash",
    "finale",
  ],
  catalogue: [
    shape,
    colour,
    candles,
    letters,
    lineup,
    toast,
    picks,
    who,
    clash,
    finale,
  ],
};
