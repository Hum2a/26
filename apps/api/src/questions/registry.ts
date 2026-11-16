import { kartSprint } from "./packs/birthday/kart-sprint.ts";
import {
  contentUnavailableMessage,
  demoQuestionSetVersion,
  pinnedQuestionSetVersion,
} from "../room/limits.ts";
import { toPlayable } from "./authoring.ts";
import type { PackProfile, Question, QuestionPack } from "./definition.ts";
import { birthdayPack } from "./packs/birthday/manifest.ts";
import { demoPack } from "./packs/demo/manifest.ts";
import type { BirthdayScript } from "./birthday-order.ts";

export type ResolvedPack = {
  packId: string;
  version: string;
  illustrative: boolean;
  profile: PackProfile;
  questions: readonly Question[];
};

export type ContentResolution =
  | { status: "lobby" }
  | { status: "playable"; pack: ResolvedPack }
  | { status: "unavailable"; version: string; reason: "draft" | "unknown" };

export const questionPacks = [demoPack, birthdayPack] as const;

const released = new Map<string, ResolvedPack>();
const drafts = new Map<string, QuestionPack>();

if (demoPack.version !== demoQuestionSetVersion) {
  throw new Error("The demo pack version does not match the pinned demo version.");
}

for (const pack of questionPacks) {
  if (pack.release === "released") {
    released.set(pack.version, {
      packId: pack.packId,
      version: pack.version,
      illustrative: pack.illustrative,
      profile: pack.profile,
      questions: playableQuestions(pack),
    });
  } else {
    drafts.set(pack.version, pack);
  }
}

/** Explicit local rehearsal only; never in the admin pack catalogue or a production start path. */
export const kartRehearsalVersion = "kart-rehearsal-v3";
const rehearsalKart = toPlayable(
  { ...kartSprint, trackId: "party-ring-v1", timeLimitMs: 45000, collectMs: 45000 },
  true,
)!;
released.set("kart-rehearsal-v1", {
  packId: "kart-rehearsal",
  version: "kart-rehearsal-v1",
  illustrative: true,
  profile: "party",
  questions: [
    released.get(demoQuestionSetVersion)!.questions[0]!,
    {
      ...rehearsalKart,
      instructions:
        "Your phone is the controller. Hold A to accelerate, steer around the clockwise circuit, B to brake and R to drift. Watch your numbered kart on the TV.",
      prompt:
        "Illustrative rehearsal: one lap, 45 seconds. Your phone drives the kart on the TV.",
    },
  ],
});
// v2 keeps the instructions it was released with; rooms that stored it keep them.
released.set("kart-rehearsal-v2", {
  ...released.get("kart-rehearsal-v1")!,
  version: "kart-rehearsal-v2",
  questions: [
    released.get(demoQuestionSetVersion)!.questions[0]!,
    {
      ...rehearsalKart,
      instructions:
        "Race on your phone. Hold A to accelerate, follow the circuit, B to brake and R to drift. The big screen shows the live map and race order.",
      prompt:
        "Illustrative rehearsal: one lap, 45 seconds. Race on your phone; follow the field on the big screen.",
    },
  ],
});
// v3: the thumb pad accelerates and brakes, so the wording no longer says "hold A".
released.set(kartRehearsalVersion, {
  ...released.get("kart-rehearsal-v1")!,
  version: kartRehearsalVersion,
  questions: [
    released.get(demoQuestionSetVersion)!.questions[0]!,
    {
      ...rehearsalKart,
      instructions:
        // Question text is capped at 200 characters.
        "Race on your phone held sideways: slide the pad to steer, push up to accelerate, pull down to brake, hold R to drift. Upright, use the slider with A and B. The big screen shows the race.",
      prompt:
        "Illustrative rehearsal: one lap, 45 seconds. Race on your phone; follow the field on the big screen.",
    },
  ],
});

export function playableQuestions(pack: QuestionPack): Question[] {
  const byId = new Map(pack.catalogue.map((question) => [question.id, question]));
  const questions: Question[] = [];
  for (const id of pack.order) {
    const playable = toPlayable(byId.get(id), pack.illustrative);
    if (!playable) {
      if (pack.release === "released") {
        throw new Error(
          `Question ${id} is in the running order for ${pack.version} but cannot be played.`,
        );
      }
      continue;
    }
    questions.push(playable);
  }
  return questions;
}

export function resolveContent(
  version: string,
  script?: BirthdayScript,
): ContentResolution {
  if (script && script.version === version)
    return {
      status: "playable",
      pack: {
        packId: "birthday",
        version,
        illustrative: false,
        profile: "party",
        questions: script.questions,
      },
    };
  if (version === pinnedQuestionSetVersion) {
    return { status: "lobby" };
  }
  const pack = released.get(version);
  if (pack) {
    return { status: "playable", pack };
  }
  if (drafts.has(version)) {
    return { status: "unavailable", version, reason: "draft" };
  }
  return { status: "unavailable", version, reason: "unknown" };
}

export function questionFor(room: {
  questionSetVersion: string;
  questionIndex: number;
  questionScript?: BirthdayScript;
}): Question | undefined {
  const resolved = resolveContent(room.questionSetVersion, room.questionScript);
  if (resolved.status !== "playable") {
    return undefined;
  }
  return resolved.pack.questions[room.questionIndex];
}

export function requirePlayable(version: string): ResolvedPack {
  const resolved = resolveContent(version);
  if (resolved.status !== "playable") {
    throw new Error(`Question version ${version} is not available.`);
  }
  return resolved.pack;
}

export function unavailableContentMessage(room: {
  phase: string;
  questionCount: number;
  questionSetVersion: string;
  questionScript?: BirthdayScript;
}): string | undefined {
  if (room.phase === "lobby" || room.questionCount <= 0) {
    return undefined;
  }
  if (
    resolveContent(room.questionSetVersion, room.questionScript).status === "playable"
  ) {
    return undefined;
  }
  return contentUnavailableMessage;
}

export const demoQuestions = requirePlayable(demoQuestionSetVersion).questions;

export function demoQuestionAt(index: number): Question | undefined {
  return demoQuestions[index];
}

export function demoCollectWindows(): number[] {
  return demoQuestions.map((question) => question.collectMs);
}
