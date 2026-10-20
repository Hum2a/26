import { z } from "zod";
import { wordleBoardSchema } from "./wordle.ts";
export {
  wordleBoardSchema,
  emptyWordleBoard,
  markWordle,
  reduceWordle,
} from "./wordle.ts";
export type { WordleBoard, WordleMark } from "./wordle.ts";
import { statCardSchema } from "./stats.ts";
export {
  adminContentSchema,
  adminMediaSchema,
  adminQuestionDetailSchema,
} from "./admin.ts";
export type { AdminContent, AdminMedia, AdminQuestionDetail } from "./admin.ts";

export { clientApiKeyHeader, clientApiKeyQueryParam } from "./client-api-key.ts";
export { minimumComparisonGroup, statCardSchema } from "./stats.ts";
export type { StatCard } from "./stats.ts";
export { resultsStatusSchema } from "./archive.ts";
export type { ResultsStatus } from "./archive.ts";
export {
  emailVerifyTtlMs,
  galleryAttribution,
  galleryCacheSeconds,
  personalResultsSchema,
  publicResultRetention,
  publicResultsSchema,
  publicStandingSchema,
  recapLinkTtlMs,
  resultsEmailSchema,
} from "./results.ts";
export type { PersonalResults, PublicResults, ResultsEmailStatus } from "./results.ts";

export {
  collectorVersion,
  detailedTelemetryPolicy,
  detailedTelemetryRetentionDays,
  deviceContextGapMs,
  deviceClassifications,
  deviceFamilies,
  guarded,
  materialHash,
  maxDeviceContextsPerPlayer,
  normaliseDeviceReport,
  reconnectCap,
  reportedScreenGroup,
  retryCap,
  rttSampleCap,
  screenGroupVersion,
  telemetryRetentionJobId,
  widerScreenShortEdge,
} from "./device-context.ts";
export type {
  DeviceClassification,
  DeviceFamily,
  NetworkQuality,
  NormalisedDeviceReport,
} from "./device-context.ts";

/** Runtime configuration supplied as a Worker var, not a process environment. */
export const appEnvironmentSchema = z.enum(["local", "staging", "production"]);

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("26-humza-website"),
  environment: appEnvironmentSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.literal("not_found"),
  message: z.string().min(1),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const apiNotFoundMessage = "This API route is not available.";

export const liveConnectionNotFoundMessage =
  "Live connections are not available in this build.";

/**
 * Display-only shape for a game id. Excludes I, O, 0, and 1 so the id stays
 * unambiguous. This does not look up a room or an archive.
 */
export const gameIdSchema = z
  .string()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8,32}$/i);

export type GameId = z.infer<typeof gameIdSchema>;

/** Control may issue live commands later. Presentation is read-only. */
export const roomCredentialRoleSchema = z.enum(["control", "presentation"]);

export type RoomCredentialRole = z.infer<typeof roomCredentialRoleSchema>;

export const adminSessionSchema = z.object({
  signedIn: z.boolean(),
  email: z.email().optional(),
});

export type AdminSession = z.infer<typeof adminSessionSchema>;

export const magicLinkAcceptanceSchema = z.object({
  accepted: z.literal(true),
  delivery: z.enum(["local-inbox", "email"]),
});

export type MagicLinkAcceptance = z.infer<typeof magicLinkAcceptanceSchema>;

export const authFailureSchema = z.object({
  error: z.enum([
    "unauthenticated",
    "forbidden",
    "misconfigured",
    "invalid",
    "expired",
  ]),
  message: z.string().min(1),
});

export type AuthFailure = z.infer<typeof authFailureSchema>;

export const devInboxMessageSchema = z.object({
  id: z.string().min(1),
  recipient: z.email(),
  subject: z.string().min(1),
  text: z.string().min(1),
});

export const devInboxSchema = z.object({
  messages: z.array(devInboxMessageSchema),
});

export type DevInbox = z.infer<typeof devInboxSchema>;

/** A stub acknowledgement. It does not change a room. */
export const roomCommandStubSchema = z.object({
  accepted: z.literal(true),
  effect: z.literal("none"),
});

export const presentationStatusSchema = z.object({
  role: z.literal("presentation"),
  roomId: gameIdSchema,
});

export const issuedCredentialSchema = z.object({
  credentialId: z.string().min(1),
  role: roomCredentialRoleSchema,
  expiresAt: z.string().min(1),
});

export type IssuedCredential = z.infer<typeof issuedCredentialSchema>;

/** Six unambiguous characters. A join code can be issued again later. */
export const joinCodeSchema = z
  .string()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/i);

export type JoinCode = z.infer<typeof joinCodeSchema>;

export const nicknameSchema = z.string().trim().min(1).max(24);

export const lobbyPhaseSchema = z.literal("lobby");

export const roomPhaseSchema = z.enum([
  "lobby",
  "intro",
  "prompt",
  "predict",
  "collect",
  "vote",
  "reveal",
  "scores",
  "final",
  "podium",
]);

export type RoomPhaseName = z.infer<typeof roomPhaseSchema>;

export const pinnedVersionSchema = z.literal("unreleased");

/** A pinned content version. `unreleased` is the lobby before a set is chosen. */
export const contentVersionSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const lobbyPlayerSchema = z
  .object({
    playerId: z.uuid(),
    nickname: z.string().min(1).max(24),
  })
  .strict();

export type LobbyPlayer = z.infer<typeof lobbyPlayerSchema>;

/** Limits shared by authoring checks and the public question contract. */
export const contentLimits = {
  questionId: /^[a-z0-9-]{1,40}$/,
  optionId: /^[a-z0-9-]{1,16}$/,
  presentationId: /^[a-z0-9-]{1,40}$/,
  promptMax: 200,
  instructionsMax: 200,
  titleMax: 80,
  labelMax: 80,
  notesMax: 500,
  explanationMax: 400,
  pointsMin: 0,
  pointsMax: 1000,
  optionMin: 2,
  optionMax: 6,
  /** A poll may list more options, such as every party on a ballot. */
  pollOptionMax: 16,
  rankMax: 8,
  collectMinMs: 15_000,
  collectMaxMs: 45_000,
  packMax: 40,
  unitMax: 24,
  typedMax: 80,
} as const;

/**
 * Custom question designs. A question names one of these as its `presentation`.
 * The server accepts only these ids, and the web app must render every one.
 */
export const customPresentationIds = [
  "glyph",
  "who-said-it",
  "now-playing",
  "scripture",
  "number-plate",
  "rage-meter",
  "ballot-paper",
  "red-blue-pill",
  "trolley-lever",
  "bin-unmasked",
  "deed-poll",
  "redacted-file",
] as const;

export type CustomPresentationId = (typeof customPresentationIds)[number];

const publicOptionIdSchema = z.string().regex(contentLimits.optionId);

/** Curated local PNGs only; no remote requests, traversal or executable URLs. */
export const questionOptionImageSchema = z
  .string()
  .regex(/^\/assets\/questions\/[a-z0-9/-]+\.png$/);

export const publicChoiceSchema = z
  .object({
    id: publicOptionIdSchema,
    label: z.string().min(1).max(contentLimits.labelMax),
    image: questionOptionImageSchema.optional(),
  })
  .strict();

const publicQuestionCore = {
  id: z.string().regex(contentLimits.questionId),
  index: z.number().int().min(1).max(contentLimits.packMax),
  total: z.number().int().min(1).max(contentLimits.packMax),
  prompt: z.string().min(1).max(contentLimits.promptMax),
  instructions: z.string().min(1).max(contentLimits.instructionsMax).optional(),
  points: z.number().int().min(contentLimits.pointsMin).max(contentLimits.pointsMax),
  illustrative: z.boolean(),
  attribution: z.enum(["never", "after", "live"]),
  presentation: z.string().regex(contentLimits.presentationId),
};

const publicPlacementSchema = z
  .object({
    itemId: publicOptionIdSchema,
    tierId: publicOptionIdSchema,
  })
  .strict();

const publicCandidateIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,36}$/);

const ballotCardSchema = z
  .object({
    id: publicCandidateIdSchema,
    label: z.string().min(1).max(80),
    own: z.boolean(),
    selectable: z.boolean(),
    author: z.string().min(1).max(24).nullable(),
  })
  .strict();

const revealCardSchema = z
  .object({
    id: publicCandidateIdSchema,
    label: z.string().min(1).max(80),
    votes: z.number().int().nonnegative(),
    winning: z.boolean(),
    author: z.string().min(1).max(24).nullable(),
    voters: z.array(z.string().min(1).max(24)).max(8).nullable(),
  })
  .strict();

const winnerSchema = z
  .object({
    id: publicCandidateIdSchema,
    label: z.string().min(1).max(80),
  })
  .strict();

export const publicQuestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("wordle"),
      wordLength: z.literal(5),
      maxGuesses: z.literal(6),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("choice"),
      options: z.array(publicChoiceSchema).min(2).max(contentLimits.pollOptionMax),
      /** Absent for an ordinary question with one right option. */
      outcome: z.enum(["poll", "threshold"]).optional(),
      speedBonus: z.boolean(),
      modifiers: z.array(z.literal("double")).max(1),
      suppressSpeedBonus: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("slider"),
      minimum: z.number().finite(),
      maximum: z.number().finite(),
      step: z.number().finite().positive(),
      unit: z.string().min(1).max(24),
      initial: z.number().finite(),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("typed"),
      maxLength: z.number().int().min(1).max(contentLimits.typedMax),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("rank"),
      mode: z.enum(["complete", "partial"]),
      ties: z.enum(["forbidden", "shared"]),
      items: z.array(publicChoiceSchema).min(2).max(8),
      tiers: z.array(publicChoiceSchema).min(2).max(8),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("vote"),
      candidateMode: z.enum(["all", "shortlist"]),
      selfVote: z.enum(["forbidden", "allowed"]),
      votes: z.literal(1),
      tie: z.literal("shared"),
      award: z.enum(["authors", "voters"]),
      lateJoin: z.literal("ineligible"),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("guess"),
      roster: z.enum(["room", "shortlist"]),
      selfVote: z.enum(["forbidden", "allowed"]),
      tie: z.literal("shared"),
      scoring: z.enum(["named", "majority", "none"]),
      lateJoin: z.literal("ineligible"),
      search: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("duel"),
      minimum: z.number().finite(),
      maximum: z.number().finite(),
      step: z.number().finite().positive(),
      target: z.number().finite(),
      within: z.number().finite().nonnegative(),
      odd: z.literal("solo"),
      tie: z.literal("shared"),
      absence: z.literal("forfeit"),
      lateJoin: z.literal("ineligible"),
      tieBreak: z.enum(["off", "tied"]),
    })
    .strict(),
  z
    .object({
      ...publicQuestionCore,
      kind: z.literal("finale"),
      minimum: z.number().finite(),
      maximum: z.number().finite(),
      step: z.number().finite().positive(),
      target: z.number().finite(),
      within: z.number().finite().nonnegative(),
      tie: z.literal("shared"),
      absence: z.literal("forfeit"),
      lateJoin: z.literal("ineligible"),
      tieBreak: z.enum(["off", "tied"]),
      contestants: z.array(z.string().min(1).max(24)).length(2),
      predictionPoints: z.number().int().min(0).max(1000),
    })
    .strict(),
]);

/** Admin-only design rehearsal: a public-field projection, never an answer key. */
export const adminQuestionPreviewSchema = z
  .object({
    question: publicQuestionSchema.nullable(),
    limitation: z.string().nullable(),
    interactive: z.boolean(),
  })
  .strict();
export const wordlePreviewInputSchema = z
  .object({
    history: z.array(z.string().regex(/^[A-Z]{5}$/)).max(5),
    word: z.string().max(80),
  })
  .strict();
export const wordlePreviewResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), state: wordleBoardSchema }).strict(),
  z.object({ ok: z.literal(false), message: z.string() }).strict(),
]);
export type AdminQuestionPreview = z.infer<typeof adminQuestionPreviewSchema>;

const selfAnswerSchema = z
  .discriminatedUnion("kind", [
    wordleBoardSchema,
    z
      .object({
        kind: z.literal("choice"),
        optionId: publicOptionIdSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("slider"),
        value: z.number().finite(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("rank"),
        placements: z.array(publicPlacementSchema).max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("text"),
        body: z.string().min(1).max(80),
      })
      .strict(),
    z
      .object({
        kind: z.literal("duel"),
        value: z.number().finite(),
      })
      .strict(),
  ])
  .nullable();

const duelResultSchema = z
  .object({
    left: z.string().min(1).max(24),
    right: z.string().min(1).max(24).nullable(),
    leftValue: z.number().finite().nullable(),
    rightValue: z.number().finite().nullable(),
    result: z.enum(["left", "right", "tie", "solo", "none"]),
  })
  .strict();

const duelBackerSchema = z
  .object({
    nickname: z.string().min(1).max(24),
    contestant: z.string().min(1).max(24),
  })
  .strict();

const duelCardSchema = z
  .object({
    id: publicCandidateIdSchema,
    label: z.string().min(1).max(24),
    selectable: z.boolean(),
  })
  .strict();

const duelStateSchema = z
  .object({
    role: z.enum(["pair", "solo", "spectator", "late"]),
    opponentId: z.uuid().nullable(),
    opponent: z.string().min(1).max(24).nullable(),
    reason: z.enum(["open", "waiting", "closed", "late"]),
    board: z
      .object({
        total: z.number().int().nonnegative().max(80),
        rows: z
          .array(
            z
              .object({
                left: z.string().min(1).max(24),
                right: z.string().min(1).max(24).nullable(),
              })
              .strict(),
          )
          .max(8),
      })
      .strict()
      .nullable(),
    cards: z.array(duelCardSchema).max(2),
  })
  .strict();

const revealSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("wordle"),
        answer: z.string().regex(/^[A-Z]{5}$/),
        solvedCount: z.number().int().nonnegative(),
        responseCount: z.number().int().nonnegative(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("choice"),
        /** Null for a poll or a threshold outcome. */
        correctOptionId: publicOptionIdSchema.nullable(),
        outcome: z.enum(["poll", "threshold"]).optional(),
        tally: z
          .array(
            z
              .object({
                optionId: publicOptionIdSchema,
                count: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(contentLimits.pollOptionMax)
          .optional(),
        winners: z
          .array(publicOptionIdSchema)
          .max(contentLimits.pollOptionMax)
          .optional(),
        everyone: z.boolean().optional(),
        met: z.boolean().nullable().optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("typed"),
        answer: z.string().min(1).max(contentLimits.typedMax),
        correctCount: z.number().int().nonnegative(),
        responseCount: z.number().int().nonnegative(),
        correctNames: z.array(z.string().min(1).max(24)).max(80).nullable(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("slider"),
        truth: z.number().finite(),
        unit: z.string().min(1).max(24),
        guesses: z
          .array(
            z
              .object({
                nickname: z.string().min(1).max(24).nullable(),
                value: z.number().finite(),
                points: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(80),
      })
      .strict(),
    z
      .object({
        kind: z.literal("rank"),
        order: z
          .array(
            z
              .object({
                tierId: publicOptionIdSchema,
                label: z.string().min(1).max(80),
                itemIds: z.array(publicOptionIdSchema).min(1).max(8),
              })
              .strict(),
          )
          .min(1)
          .max(8),
        rankings: z
          .array(
            z
              .object({
                nickname: z.string().min(1).max(24).nullable(),
                points: z.number().int().nonnegative(),
                placements: z.array(publicPlacementSchema).max(8),
              })
              .strict(),
          )
          .max(80),
      })
      .strict(),
    z
      .object({
        kind: z.literal("vote"),
        totalBallots: z.number().int().nonnegative(),
        featured: z.boolean(),
        winnerCount: z.number().int().nonnegative(),
        winners: z.array(winnerSchema).max(8),
        cards: z.array(revealCardSchema).max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("guess"),
        totalBallots: z.number().int().nonnegative(),
        featured: z.boolean(),
        winnerCount: z.number().int().nonnegative(),
        winners: z.array(winnerSchema).max(8),
        truthLabel: z.string().min(1).max(24).nullable(),
        cards: z.array(revealCardSchema).max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("duel"),
        pairCount: z.number().int().nonnegative(),
        pairs: z.array(duelResultSchema).max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("finale"),
        pairCount: z.number().int().nonnegative(),
        pairs: z.array(duelResultSchema).max(8),
        predictionCount: z.number().int().nonnegative(),
        backers: z.array(duelBackerSchema).max(8).nullable(),
      })
      .strict(),
  ])
  .nullable();

export const playSnapshotSchema = z
  .object({
    question: publicQuestionSchema,
    submissionCount: z.number().int().nonnegative(),
    selfAnswer: selfAnswerSchema,
    selfBallot: z
      .object({
        candidateId: publicCandidateIdSchema,
      })
      .strict()
      .nullable(),
    ballot: z
      .object({
        total: z.number().int().nonnegative().max(80),
        reason: z.enum(["open", "late", "empty", "closed"]),
        cards: z.array(ballotCardSchema).max(80),
      })
      .strict()
      .nullable(),
    duel: duelStateSchema.nullable(),
    reveal: revealSchema,
    selfAward: z.number().int().nonnegative().nullable(),
    selfStanding: z
      .object({
        place: z.number().int().positive(),
        points: z.number().int(),
        players: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    standings: z
      .array(
        z
          .object({
            place: z.number().int().positive(),
            nickname: z.string().min(1).max(24),
            points: z.number().int(),
          })
          .strict(),
      )
      .max(80)
      .nullable(),
    liveSample: z.array(z.string().min(1).max(24)).max(8).nullable(),
    attributions: z
      .array(
        z
          .object({
            optionId: publicOptionIdSchema,
            nicknames: z.array(z.string().min(1).max(24)).max(80),
          })
          .strict(),
      )
      .max(contentLimits.pollOptionMax)
      .nullable(),
    hostAnswers: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            nickname: z.string().min(1).max(24),
            optionId: publicOptionIdSchema,
          })
          .strict(),
      )
      .max(80)
      .optional(),
    hostResponses: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            nickname: z.string().min(1).max(24),
            summary: z.string().min(1).max(200),
            candidateId: publicCandidateIdSchema.optional(),
            included: z.boolean().optional(),
            votes: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .max(80)
      .optional(),
    explanation: z.string().min(1).max(contentLimits.explanationMax).nullable(),
    presenterNotes: z.string().min(1).max(contentLimits.notesMax).optional(),
  })
  .strict();

export type PlaySnapshot = z.infer<typeof playSnapshotSchema>;

/** Public lobby view. Verifiers, transfer codes, and admin details are absent. */
export const lobbySnapshotSchema = z
  .object({
    gameId: gameIdSchema,
    joinCode: joinCodeSchema,
    phase: roomPhaseSchema,
    paused: z.boolean(),
    held: z.boolean(),
    deadlineAt: z.number().int().nullable(),
    remainingMs: z.number().int().nullable(),
    serverNow: z.number().int(),
    stateVersion: z.number().int().nonnegative(),
    questionSetVersion: contentVersionSchema,
    scoringVersion: contentVersionSchema,
    players: z.array(lobbyPlayerSchema),
    // Private operator projection. Never present on stage or guest snapshots.
    adminPlayers: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            nickname: nicknameSchema,
            points: z.number().int(),
            connected: z.boolean(),
            removed: z.boolean(),
            answered: z.boolean().nullable(),
          })
          .strict(),
      )
      .optional(),
    selfPlayerId: z.uuid().optional(),
    play: playSnapshotSchema.nullable(),
    cloud: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            nickname: z.string().min(1).max(24),
            likes: z.number().int().nonnegative(),
            dislikes: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(80),
    selfReactions: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            reaction: z.enum(["like", "dislike"]),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    namesReveal: z
      .object({
        liked: z
          .array(
            z
              .object({
                nickname: z.string().min(1).max(24),
                count: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(3),
        disliked: z
          .array(
            z
              .object({
                nickname: z.string().min(1).max(24),
                count: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(3),
      })
      .strict()
      .nullable(),
    stageHidden: z.boolean(),
    finishAfterRound: z.boolean(),
    revealNonce: z.number().int().nonnegative(),
    media: z
      .array(
        z
          .object({
            mediaId: z.uuid(),
            kind: z.enum(["photo", "voice"]),
            nickname: z.string().min(1).max(24),
            hidden: z.boolean().optional(),
          })
          .strict(),
      )
      .max(20),
    draft: z
      .object({
        nickname: z.string().min(1).max(24),
        text: z.string().min(1).max(80),
      })
      .strict()
      .optional(),
    trolls: z
      .object({
        token: z.enum(["locked", "ready", "spent"]),
        offers: z
          .array(
            z
              .object({
                kind: z.enum([
                  "invasion",
                  "call",
                  "crack",
                  "yield",
                  "swap",
                  "hide-score",
                  "double",
                  "typing",
                  "voice",
                  "theme",
                  "sponsor",
                ]),
                label: z.string().min(1).max(40),
                enabled: z.boolean(),
              })
              .strict(),
          )
          .max(12),
        active: z
          .array(
            z
              .object({
                effectId: z.uuid(),
                kind: z.enum([
                  "invasion",
                  "call",
                  "crack",
                  "yield",
                  "swap",
                  "hide-score",
                  "double",
                  "typing",
                  "voice",
                  "theme",
                  "sponsor",
                ]),
                role: z.enum(["actor", "target"]),
                status: z.enum(["queued", "active"]),
                expiresAt: z.number().int().nullable(),
                label: z.string().min(1).max(40),
                escape: z.string().min(1).max(40).nullable(),
                assetLabel: z.string().min(1).max(40),
              })
              .strict(),
          )
          .max(4),
        announcement: z
          .object({
            cueId: z.uuid(),
            label: z.string().min(1).max(120),
            assetLabel: z.string().min(1).max(40),
            mediaId: z.uuid().optional(),
            mediaKind: z.enum(["photo", "voice"]).optional(),
            audioAsset: z.string().min(1).max(80).optional(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    connections: z
      .object({
        guests: z.number().int().nonnegative(),
        stage: z.number().int().nonnegative(),
        control: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    hostEffects: z
      .array(
        z
          .object({
            effectId: z.uuid(),
            label: z.string().min(1).max(40),
            actorNickname: z.string().min(1).max(24),
            targetNickname: z.string().min(1).max(24),
            status: z.enum(["queued", "active"]),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    adjustments: z
      .array(
        z
          .object({
            playerId: z.uuid(),
            nickname: z.string().min(1).max(24),
            points: z.number().int(),
            reason: z.string().min(3).max(80),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    highlights: z.array(statCardSchema).max(8).optional(),
    recap: z.array(statCardSchema).max(6).optional(),
    archive: z
      .object({
        status: z.enum(["pending", "failed", "completed"]),
        revision: z.number().int().nonnegative(),
        attempts: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type LobbySnapshot = z.infer<typeof lobbySnapshotSchema>;

export const lobbyCreatedSchema = z
  .object({
    gameId: gameIdSchema,
    joinCode: joinCodeSchema,
    phase: lobbyPhaseSchema,
    questionSetVersion: pinnedVersionSchema,
    scoringVersion: pinnedVersionSchema,
    playerCount: z.number().int().nonnegative(),
  })
  .strict();

export type LobbyCreated = z.infer<typeof lobbyCreatedSchema>;

// Registry entries deliberately contain no live counts or phase: only the room
// can provide those authoritatively. Listing never wakes every game object.
export const adminRoomListSchema = z.object({
  rooms: z.array(
    z.object({
      gameId: gameIdSchema,
      joinCode: joinCodeSchema,
      createdAt: z.string().datetime(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type AdminRoomList = z.infer<typeof adminRoomListSchema>;

export const mediaSlotSchema = z
  .object({
    uploadId: z.uuid(),
    expiresAt: z.number().int(),
    uploadUrl: z.string().min(1).max(2000),
    contentType: z.enum(["image/jpeg", "audio/wav"]),
  })
  .strict();

export type MediaSlot = z.infer<typeof mediaSlotSchema>;

export const mediaFinalSchema = z
  .object({
    ok: z.literal(true),
    mediaId: z.uuid(),
    kind: z.enum(["photo", "voice"]),
    repeated: z.boolean(),
  })
  .strict();

export type MediaFinal = z.infer<typeof mediaFinalSchema>;

export const playCommandSchema = z
  .object({
    ok: z.literal(true),
    phase: roomPhaseSchema,
    paused: z.boolean(),
    held: z.boolean(),
    stateVersion: z.number().int().nonnegative(),
    transferCode: z.string().optional(),
    released: z.number().int().nonnegative().optional(),
    retried: z.number().int().nonnegative().optional(),
  })
  .strict();

export type PlayCommand = z.infer<typeof playCommandSchema>;

export const roomDiagnosticsSchema = z
  .object({
    gameId: gameIdSchema,
    phase: roomPhaseSchema,
    paused: z.boolean(),
    held: z.boolean(),
    questionId: z.string().min(1).max(40).nullable(),
    questionIndex: z.number().int().nonnegative(),
    questionSetVersion: z.string().min(1).max(80),
    scoringVersion: z.string().min(1).max(80),
    players: z.number().int().nonnegative(),
    connections: z
      .object({
        guests: z.number().int().nonnegative(),
        stage: z.number().int().nonnegative(),
        control: z.number().int().nonnegative(),
      })
      .strict(),
    scheduler: z
      .object({
        alarmAt: z.number().int().nullable(),
        pending: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        jobs: z
          .array(
            z
              .object({
                jobType: z.string().min(1).max(40),
                status: z.string().min(1).max(40),
                dueAt: z.number().int().nullable(),
                phase: z.string().min(1).max(40).nullable(),
                retryCount: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(12),
      })
      .strict(),
    media: z
      .object({
        open: z.number().int().nonnegative(),
        leased: z.number().int().nonnegative(),
        staged: z.number().int().nonnegative(),
        accepted: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        expired: z.number().int().nonnegative(),
        cancelled: z.number().int().nonnegative(),
        attention: z
          .array(
            z
              .object({
                status: z.string().min(1).max(40),
                nickname: z.string().min(1).max(24),
                failure: z.string().min(1).max(180),
              })
              .strict(),
          )
          .max(12),
      })
      .strict(),
    archive: z
      .object({
        status: z.enum(["pending", "failed", "completed"]),
        targetRevision: z.number().int().nonnegative(),
        verifiedRevision: z.number().int().nonnegative().nullable(),
        attempts: z.number().int().nonnegative(),
        lastError: z.string().min(1).max(180).nullable(),
      })
      .strict()
      .nullable(),
    delivery: z
      .object({
        available: z.boolean(),
        pending: z.number().int().nonnegative(),
        uncertain: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        sent: z.number().int().nonnegative(),
        testRecipient: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type RoomDiagnostics = z.infer<typeof roomDiagnosticsSchema>;

export const guestSessionSchema = z
  .object({
    gameId: gameIdSchema,
    joinCode: joinCodeSchema,
    playerId: z.uuid(),
    nickname: z.string().min(1).max(24),
    stateVersion: z.number().int().nonnegative(),
  })
  .strict();

export type GuestSession = z.infer<typeof guestSessionSchema>;

export const transferCodeSchema = z
  .string()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/i);

export const transferIssuedSchema = z
  .object({
    code: transferCodeSchema,
    expiresAt: z.string().min(1),
    playerId: z.uuid(),
  })
  .strict();

export type TransferIssued = z.infer<typeof transferIssuedSchema>;

export const roomClientErrorSchema = z.object({
  error: z.enum([
    "unauthenticated",
    "forbidden",
    "invalid",
    "conflict",
    "full",
    "expired",
    "digest_mismatch",
    "not_found",
  ]),
  message: z.string().min(1),
});

export type RoomClientError = z.infer<typeof roomClientErrorSchema>;

export const newerTabMessage = "This game is open in a newer tab.";

export const movedSessionMessage = "This session was moved to another device.";

export const removedSessionMessage = "This phone was removed from the game.";

/**
 * A public room version can skip while this connection was asleep.
 * That gap asks for a fresh snapshot. It is not a missing private acknowledgement.
 */
export function publicVersionNeedsSnapshot(previous: number, next: number): boolean {
  return previous > 0 && next > previous + 1;
}

/**
 * Entertainment audio is not exactly-once across a crash.
 * A cue already on screen at load, already played, muted, or expired is dropped.
 * A locked browser waits until the stage unlocks sound, then plays the cue once.
 * Score and token rows stay exactly-once elsewhere.
 */
export function entertainmentCueDecision(input: {
  cueId: string | null;
  muted: boolean;
  unlocked: boolean;
  playedIds: readonly string[];
  presentBeforeListening: boolean;
}): "play" | "wait" | "drop" {
  if (input.cueId === null || input.playedIds.includes(input.cueId)) {
    return "drop";
  }
  if (input.presentBeforeListening || input.muted) {
    return "drop";
  }
  if (!input.unlocked) {
    return "wait";
  }
  return "play";
}

/** Local countdown. The server deadline is the clock; nothing ticks in storage. */
export function formatPhaseClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function remainingUntil(
  deadlineAt: number,
  serverNow: number,
  observedAt: number,
  now: number,
): number {
  return deadlineAt - (serverNow + (now - observedAt));
}
