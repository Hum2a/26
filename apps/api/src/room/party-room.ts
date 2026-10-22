import {
  kartRehearsalVersion,
  requirePlayable as requireKartRehearsal,
} from "../questions/registry.ts";
import {
  acceptKartInputs,
  kartFrames,
  KartInputBuffer,
  releaseKartInputs,
  recoverKart,
  useKartItem,
  readKart,
} from "../questions/kart.ts";
import { readRoundState } from "../questions/round-state.ts";
import { DurableObject } from "cloudflare:workers";
import { createRealtimeMeter } from "./realtime-meter.ts";
import { adminPlayerRows } from "./admin-players.ts";
import {
  guestSessionSchema,
  lobbySnapshotSchema,
  movedSessionMessage,
  newerTabMessage,
  removedSessionMessage,
  nicknameSchema,
  type GuestSession,
  type KartFrame,
  type LobbySnapshot,
  type RateBucket,
  type RateLimit,
  commandRateLimit,
  draftRateLimit,
  takeToken,
  telemetryRateLimit,
  timeRateLimit,
} from "@26/shared";
import {
  readCredentialCookie,
  readGuestCookie,
  sameOriginRejection,
} from "../credentials/cookies.ts";
import { rejectUnlessClientApiKey } from "../security/client-api-key.ts";
import type { RoomCredentialRole, TrollKindName } from "@26/shared";
import {
  createCredentialSecret,
  credentialLifetimeMs,
  guestCredentialTtlMs,
  hashCredentialSecret,
  verifyGuestSecret,
  verifyRoomCredential,
} from "../credentials/verify.ts";
import { randomToken } from "./codes.ts";
import { payloadDigest } from "./digest.ts";
import { createSqliteRoomCredentialDirectory, insertCredential } from "./directory.ts";
import {
  digestMismatchMessage,
  mediaMissingMessage,
  maxPayloadBytes,
  maxPlayers,
  maxTransfers,
  messageLimitMessage,
  nicknameTakenMessage,
  pinnedQuestionSetVersion,
  pinnedScoringVersion,
  answerClosedMessage,
  answerDuplicateMessage,
  answerHeldMessage,
  answerLateMessage,
  answerPausedMessage,
  answerRoleMessage,
  answerUnknownMessage,
  controlMissingMessage,
  demoQuestionSetVersion,
  demoScoringVersion,
  finishClosedMessage,
  skipClosedMessage,
  playerMissingMessage,
  roomFullMessage,
  roomMissingMessage,
  roundStartMessage,
  transferExpiredMessage,
  transferInvalidMessage,
  transferLimitMessage,
  transferTtlMs,
  transferUsedMessage,
} from "./limits.ts";
import {
  acceptAnswer,
  advance,
  finishGame,
  fixturePlugin,
  notePresence,
  onAlarm,
  pause,
  publicClock,
  resume,
  skipQuestion,
  startRound,
  type GameStore,
  type RoomPhase,
} from "./lifecycle.ts";
import { applyHostAction, type HostActionInput } from "./host-actions.ts";
import {
  applyReaction,
  cloudRows,
  recentAdjustments,
  revealNames,
  seedDemoNames,
  voterReactions,
} from "./names.ts";
import { commitAndArm } from "./scheduler.ts";
import { ensurePartySchema } from "./schema.ts";
import { createSqlStore } from "./sql-store.ts";
import type { Question } from "../questions/definition.ts";
import { questionFor, unavailableContentMessage } from "../questions/registry.ts";
import {
  acceptChoice,
  createGameStore,
  ledgerCount,
  ledgerTotal,
  multipleChoicePlugin,
  projectPlay,
  recordRevealScores,
} from "../questions/multiple-choice.ts";
import { acceptDuel, acceptPrediction, wrongKindDuel } from "../questions/duel.ts";
import {
  claimUpload,
  clearPrepared,
  commitUpload,
  listUploads,
  readServable,
  rejectUpload,
  releaseUpload,
  rememberSource,
  reserveUpload,
  stageUpload,
  temporaryWrite,
  type MediaPurpose,
} from "../media/records.ts";
import { readDrivers, saveDriver } from "./drivers.ts";
import { draftGapMs } from "../troll/catalogue.ts";
import {
  acceptDeviceReport,
  clearCurrentContext,
  configureTelemetryRetention,
  ensureTelemetryRetention,
  mergeConnectionSummary,
  noteGuestSocket,
  readTelemetry,
} from "../device/store.ts";
import { presentStats } from "../stats/aggregate.ts";
import { readStatsSource } from "../stats/source.ts";
import { funFactApplies } from "../stats/fun-facts.ts";
import { readFunFactSelection } from "../stats/fun-source.ts";
import { readRoomArchive } from "../archive/schedule.ts";
import { readRoomDiagnostics } from "./diagnostics.ts";
import { createWallPost, reactToWall, withdrawWallPost } from "../wall/store.ts";
import { wallMediaViewable } from "../wall/access.ts";
import { wallSnapshot } from "../wall/snapshot.ts";
import { syncWall } from "../wall/queue.ts";
import { seedSampleRoom, type SampleMedia } from "./sample.ts";
import type { WallSettingsChange } from "../wall/moderation.ts";

type WallCommand =
  | {
      name: "wall-post";
      mediaId: unknown;
      caption: unknown;
      frame: unknown;
      keep: unknown;
    }
  | { name: "wall-withdraw"; postId: unknown }
  | { name: "wall-react"; postId: unknown; reaction: unknown };
import { adminMedia } from "./admin-media.ts";
import { scoreSummaryMarkdown } from "./score-summary.ts";
import { archiveWriterFor, settleArchive } from "../archive/settle.ts";
import type { ArchiveWriter } from "../archive/store.ts";
import { presentBinding, type AuthBindings } from "../auth/bindings.ts";
import {
  createEmail,
  restrictResultsEmail,
  type EmailSender,
} from "../auth/create-email.ts";
import { createDatabase, type AppDatabase } from "../auth/create-database.ts";
import {
  confirmVerification,
  personalFromGrant,
  retryStoredDeliveries,
  startVerification,
} from "../results/delivery.ts";
import { postgresDelivery } from "../results/postgres-delivery.ts";
import { toPersonalResults, toPublicResults } from "../results/project.ts";
import {
  listSqliteOutbox,
  sqliteDelivery,
  sqliteOutbox,
} from "../results/sqlite-delivery.ts";
import type { PersonalResults, PublicResults } from "@26/shared";
import {
  acceptTroll,
  displayNickname,
  enqueuePhotoCue,
  escapeTroll,
  hidesPersonalScore,
  hostTrollRows,
  trollHistoryRows,
  trollSnapshot,
} from "../troll/engine.ts";
import { acceptMultiple } from "../questions/multiple.ts";
import { acceptRanking, wrongKindRank } from "../questions/rank.ts";
import { acceptEstimate, wrongKindEstimate } from "../questions/slider.ts";
import { acceptWordleGuess } from "../questions/wordle.ts";
import { acceptTypedAnswer } from "../questions/typed.ts";
import {
  acceptBallot,
  acceptText,
  wrongKindBallot,
  wrongKindText,
} from "../questions/vote.ts";

type RoomRow = {
  game_id: string;
  join_code: string;
  phase: string;
  question_set_version: string;
  scoring_version: string;
  state_version: number;
  created_at: string;
};

type SocketRole = "guest" | "control" | "presentation";

type SocketAttachment = {
  role: SocketRole;
  principalId: string;
  deliverySeq: number;
  /** The screen said it can apply patches. Older builds get full snapshots. */
  patches?: true;
};

type BroadcastScope = "all" | "facilitators" | "stage";
type SentView = { id: string; fields: Map<string, string> };

function viewKey(attachment: { role: string; principalId: string }): string {
  return `${attachment.role}:${attachment.principalId}`;
}
type SnapshotPartsCache = Map<string, ReturnType<PartyRoom["snapshotParts"]>>;
/** Changes inside this window share one fan-out. Short enough not to be seen. */
const broadcastWindowMs = 30;
/** Three buckets for each of 80 phones plus stage and control, with room to spare. */
const maxRateBuckets = 400;

type CredentialSecrets = {
  credentialId: string;
  secret: string;
  expiresAt: string;
};

export type LobbyBootstrap = {
  gameId: string;
  joinCode: string;
  phase: "lobby";
  questionSetVersion: "unreleased";
  scoringVersion: "unreleased";
  playerCount: number;
  control: CredentialSecrets;
  presentation: CredentialSecrets;
};

export type GuestJoinResult =
  | {
      ok: true;
      gameId: string;
      joinCode: string;
      playerId: string;
      nickname: string;
      secret: string;
      expiresAt: string;
      stateVersion: number;
    }
  | {
      ok: false;
      error: "invalid" | "conflict" | "full" | "digest_mismatch" | "not_found";
      message: string;
    };

export type TransferIssueResult =
  | { ok: true; code: string; expiresAt: string; playerId: string }
  | {
      ok: false;
      error: "invalid" | "digest_mismatch" | "full" | "not_found";
      message: string;
    };

export type TransferRedeemResult =
  | GuestJoinResult
  | {
      ok: false;
      error: "expired" | "invalid" | "digest_mismatch" | "not_found";
      message: string;
    };

type PhaseCommandResult =
  | {
      ok: true;
      phase: RoomPhase;
      paused: boolean;
      held: boolean;
      stateVersion: number;
      transferCode?: string;
      released?: number;
      retried?: number;
    }
  | {
      ok: false;
      error: "invalid" | "unauthenticated" | "forbidden";
      message: string;
    };

type Failure = {
  ok: false;
  status: 401 | 403 | 404;
  error: "unauthenticated" | "forbidden" | "not_found";
  message: string;
};

/**
 * One SQLite object per game id. Memory is not the record.
 * Accepted work is written before any success acknowledgement.
 * Phase deadlines go through the room scheduler, which owns the alarm.
 */
export class PartyRoom extends DurableObject<Env> {
  private archiveWriterOverride: ArchiveWriter | undefined;
  private emailSenderOverride: EmailSender | undefined;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ensurePartySchema(ctx.storage.sql);
      this.ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair("ping", "pong"),
      );
    });
  }

  private liveDrafts = new Map<string, { text: string; shownAt: number }>();
  private draftFlush: ReturnType<typeof setTimeout> | undefined;
  private readonly meter = createRealtimeMeter();
  private database: Promise<AppDatabase> | undefined;
  private kartArrivals = new KartInputBuffer();
  private rateBuckets = new Map<string, RateBucket>();
  /** The last view each socket holds, and per screen for resume. Memory only. */
  private views = new WeakMap<WebSocket, SentView>();
  private lastViews = new Map<string, SentView>();
  private readonly viewEpoch = randomToken(6);
  private viewCount = 0;
  private dirty = new Set<BroadcastScope>();
  private broadcastFlush: ReturnType<typeof setTimeout> | undefined;

  async ensureLobby(input: {
    gameId: string;
    joinCode: string;
    now: string;
  }): Promise<LobbyBootstrap> {
    const gameId = input.gameId.toUpperCase();
    const joinCode = input.joinCode.toUpperCase();
    const existing = this.readBootstrap();
    if (existing) {
      return this.toBootstrap(existing);
    }
    const now = new Date(input.now);
    const control = await this.prepareCredential("control", now);
    const presentation = await this.prepareCredential("presentation", now);
    const digest = await payloadDigest({ gameId });
    try {
      this.ctx.storage.transactionSync(() => {
        if (this.readRoom()) {
          return;
        }
        this.ctx.storage.sql.exec(
          `INSERT INTO room (
            game_id, join_code, phase, question_set_version, scoring_version, state_version, created_at
          ) VALUES (?, ?, 'lobby', ?, ?, 1, ?)`,
          gameId,
          joinCode,
          pinnedQuestionSetVersion,
          pinnedScoringVersion,
          input.now,
        );
        insertCredential(this.ctx.storage.sql, {
          id: control.credentialId,
          principal: "control",
          playerId: null,
          secretHash: control.secretHash,
          expiresAt: control.expiresAt,
        });
        insertCredential(this.ctx.storage.sql, {
          id: presentation.credentialId,
          principal: "presentation",
          playerId: null,
          secretHash: presentation.secretHash,
          expiresAt: presentation.expiresAt,
        });
        this.writeReceipt("bootstrap", "credentials", digest, {
          control: publicSecret(control),
          presentation: publicSecret(presentation),
        });
        this.writeAudit("room_created", "control", input.now, { gameId });
      });
    } catch (error) {
      if (!String(error).includes("UNIQUE")) {
        throw error;
      }
    }
    const stored = this.readBootstrap();
    if (!stored) {
      throw new Error("Room bootstrap was not saved.");
    }
    await commitAndArm(this.ctx.storage, (sql) => {
      ensureTelemetryRetention(sql, Date.now());
    });
    return this.toBootstrap(stored);
  }

  async joinPlayer(input: {
    nickname: string;
    requestId: string;
    now: string;
  }): Promise<GuestJoinResult> {
    if (!this.readRoom()) {
      return { ok: false, error: "not_found", message: roomMissingMessage };
    }
    const nickname = nicknameSchema.safeParse(input.nickname);
    if (!nickname.success || !validRequestId(input.requestId)) {
      return {
        ok: false,
        error: "invalid",
        message: "Enter a nickname of 1 to 24 characters.",
      };
    }
    const digest = await payloadDigest({ nickname: nickname.data });
    const prior = this.readReceipt("join", input.requestId);
    if (prior) {
      return this.replay(prior, digest);
    }
    const secret = createCredentialSecret();
    const secretHash = await hashCredentialSecret(secret);
    const playerId = crypto.randomUUID();
    const credentialId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.parse(input.now) + guestCredentialTtlMs,
    ).toISOString();
    let result: GuestJoinResult = {
      ok: false,
      error: "conflict",
      message: nicknameTakenMessage,
    };
    try {
      this.ctx.storage.transactionSync(() => {
        const replay = this.readReceipt("join", input.requestId);
        if (replay) {
          result = this.replay(replay, digest);
          return;
        }
        const taken = this.ctx.storage.sql
          .exec(
            `SELECT player_id FROM player WHERE revoked_at IS NULL AND nickname_key = ?`,
            nickname.data.toLowerCase(),
          )
          .toArray()[0];
        if (taken) {
          result = { ok: false, error: "conflict", message: nicknameTakenMessage };
          this.writeReceipt("join", input.requestId, digest, result);
          return;
        }
        const count = this.countActivePlayers();
        if (count >= maxPlayers) {
          result = { ok: false, error: "full", message: roomFullMessage };
          this.writeReceipt("join", input.requestId, digest, result);
          return;
        }
        this.ctx.storage.sql.exec(
          `INSERT INTO player (
            player_id, nickname, nickname_key, revoked_at, device_context_id,
            device_context_version, joined_at
          ) VALUES (?, ?, ?, NULL, NULL, NULL, ?)`,
          playerId,
          nickname.data,
          nickname.data.toLowerCase(),
          input.now,
        );
        insertCredential(this.ctx.storage.sql, {
          id: credentialId,
          principal: "guest",
          playerId,
          secretHash,
          expiresAt,
        });
        this.writeCount("room", "joins");
        const stateVersion = this.bumpState();
        const room = this.readRoom();
        result = {
          ok: true,
          gameId: room?.game_id ?? "",
          joinCode: room?.join_code ?? "",
          playerId,
          nickname: nickname.data,
          secret,
          expiresAt,
          stateVersion,
        };
        this.writeReceipt("join", input.requestId, digest, result);
        this.writeAudit("player_joined", playerId, input.now, {
          nickname: nickname.data,
        });
      });
    } catch (error) {
      if (!String(error).includes("UNIQUE")) {
        throw error;
      }
      const replay = this.readReceipt("join", input.requestId);
      if (replay) {
        return this.replay(replay, digest);
      }
      return { ok: false, error: "conflict", message: nicknameTakenMessage };
    }
    if (result.ok) {
      this.broadcast();
    }
    return result;
  }

  async resumeGuest(input: {
    playerId: string;
    secret: string;
    now: string;
  }): Promise<
    | { ok: true; session: GuestSession }
    | { ok: false; error: "unauthenticated" | "not_found"; message: string }
  > {
    const room = this.readRoom();
    if (!room) {
      return { ok: false, error: "not_found", message: roomMissingMessage };
    }
    const check = await this.verifyGuest(
      input.playerId,
      input.secret,
      new Date(input.now),
    );
    if (!check.ok) {
      return {
        ok: false,
        error: "unauthenticated",
        message: "Join this room before continuing.",
      };
    }
    const player = this.readPlayer(input.playerId);
    if (!player) {
      return {
        ok: false,
        error: "unauthenticated",
        message: "Join this room before continuing.",
      };
    }
    return {
      ok: true,
      session: guestSessionSchema.parse({
        gameId: room.game_id,
        joinCode: room.join_code,
        playerId: player.player_id,
        nickname: player.nickname,
        stateVersion: room.state_version,
      }),
    };
  }

  async issueTransfer(input: {
    playerId: string;
    requestId: string;
    now: string;
  }): Promise<TransferIssueResult> {
    if (!this.readRoom()) {
      return { ok: false, error: "not_found", message: roomMissingMessage };
    }
    if (!validRequestId(input.requestId)) {
      return { ok: false, error: "invalid", message: "That request was not accepted." };
    }
    const digest = await payloadDigest({ playerId: input.playerId });
    const prior = this.readReceipt("control", input.requestId);
    if (prior) {
      return this.replay(prior, digest);
    }
    const code = randomToken(8);
    const codeHash = await hashCredentialSecret(code);
    const expiresAt = new Date(Date.parse(input.now) + transferTtlMs).toISOString();
    let result: TransferIssueResult = {
      ok: false,
      error: "invalid",
      message: playerMissingMessage,
    };
    this.ctx.storage.transactionSync(() => {
      const replay = this.readReceipt("control", input.requestId);
      if (replay) {
        result = this.replay(replay, digest);
        return;
      }
      const player = this.readPlayer(input.playerId);
      if (!player || player.revoked_at) {
        result = { ok: false, error: "invalid", message: playerMissingMessage };
        this.writeReceipt("control", input.requestId, digest, result);
        return;
      }
      const issued = this.readCount("room", "transfers");
      if (issued >= maxTransfers) {
        result = { ok: false, error: "full", message: transferLimitMessage };
        this.writeReceipt("control", input.requestId, digest, result);
        return;
      }
      this.ctx.storage.sql.exec(
        `INSERT INTO transfer (code_hash, player_id, expires_at, consumed_at) VALUES (?, ?, ?, NULL)`,
        codeHash,
        input.playerId,
        expiresAt,
      );
      this.writeCount("room", "transfers");
      result = { ok: true, code, expiresAt, playerId: input.playerId };
      this.writeReceipt("control", input.requestId, digest, result);
      this.writeAudit("transfer_issued", "control", input.now, {
        playerId: input.playerId,
      });
    });
    return result;
  }

  async redeemTransfer(input: {
    code: string;
    requestId: string;
    now: string;
  }): Promise<TransferRedeemResult> {
    if (!this.readRoom()) {
      return { ok: false, error: "not_found", message: roomMissingMessage };
    }
    if (!validRequestId(input.requestId)) {
      return { ok: false, error: "invalid", message: transferInvalidMessage };
    }
    const code = input.code.toUpperCase();
    const digest = await payloadDigest({ code });
    const prior = this.readReceipt("transfer", input.requestId);
    if (prior) {
      return this.replay(prior, digest);
    }
    const codeHash = await hashCredentialSecret(code);
    const existing = this.ctx.storage.sql
      .exec<{ player_id: string; expires_at: string; consumed_at: string | null }>(
        `SELECT player_id, expires_at, consumed_at FROM transfer WHERE code_hash = ?`,
        codeHash,
      )
      .toArray()[0];
    if (!existing) {
      return { ok: false, error: "invalid", message: transferInvalidMessage };
    }
    if (existing.consumed_at) {
      return { ok: false, error: "invalid", message: transferUsedMessage };
    }
    if (Date.parse(existing.expires_at) <= Date.parse(input.now)) {
      return { ok: false, error: "expired", message: transferExpiredMessage };
    }
    const secret = createCredentialSecret();
    const secretHash = await hashCredentialSecret(secret);
    const credentialId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.parse(input.now) + guestCredentialTtlMs,
    ).toISOString();
    const playerId = existing.player_id;
    let result: TransferRedeemResult = {
      ok: false,
      error: "invalid",
      message: transferInvalidMessage,
    };
    this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql
        .exec<{ consumed_at: string | null; expires_at: string }>(
          `SELECT consumed_at, expires_at FROM transfer WHERE code_hash = ?`,
          codeHash,
        )
        .toArray()[0];
      if (!current || current.consumed_at) {
        result = { ok: false, error: "invalid", message: transferUsedMessage };
        return;
      }
      if (Date.parse(current.expires_at) <= Date.parse(input.now)) {
        result = { ok: false, error: "expired", message: transferExpiredMessage };
        return;
      }
      this.ctx.storage.sql.exec(
        `UPDATE transfer SET consumed_at = ? WHERE code_hash = ?`,
        input.now,
        codeHash,
      );
      this.ctx.storage.sql.exec(
        `UPDATE credential SET revoked_at = ?
         WHERE player_id = ? AND principal = 'guest' AND revoked_at IS NULL`,
        input.now,
        playerId,
      );
      insertCredential(this.ctx.storage.sql, {
        id: credentialId,
        principal: "guest",
        playerId,
        secretHash,
        expiresAt,
      });
      clearCurrentContext(this.ctx.storage.sql, playerId);
      const room = this.readRoom();
      const player = this.readPlayer(playerId);
      result = {
        ok: true,
        gameId: room?.game_id ?? "",
        joinCode: room?.join_code ?? "",
        playerId,
        nickname: player?.nickname ?? "",
        secret,
        expiresAt,
        stateVersion: room?.state_version ?? 0,
      };
      this.writeReceipt("transfer", input.requestId, digest, result);
      this.writeAudit("transfer_redeemed", playerId, input.now, { playerId });
    });
    if (result.ok) {
      this.closePlayerSockets(playerId, movedSessionMessage);
    }
    return result;
  }

  async verifyPresentation(input: {
    credentialId: string;
    secret: string;
    now: string;
  }): Promise<{ ok: true } | { ok: false }> {
    const room = this.readRoom();
    if (!room) {
      return { ok: false };
    }
    const record = await createSqliteRoomCredentialDirectory(this.ctx.storage.sql).get(
      input.credentialId,
    );
    if (!record) {
      return { ok: false };
    }
    const check = await verifyRoomCredential({
      credentialId: input.credentialId,
      secret: input.secret,
      record,
      now: new Date(input.now),
      roomId: room.game_id,
      role: "presentation",
    });
    return check.ok ? { ok: true } : { ok: false };
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    let raceTickOnly = false;
    await commitAndArm(this.ctx.storage, (sql) => {
      this.flushKartInputs(sql);
      const store = createGameStore(sql);
      const before = store.readRoom();
      const due = sql
        .exec<{ payload: string }>(
          `SELECT payload FROM schedule_job
           WHERE status = 'pending' AND due_at IS NOT NULL AND due_at <= ?`,
          now,
        )
        .toArray();
      onAlarm(store, now);
      const after = store.readRoom();
      // A tick that only moved the race goes out as a kart frame, not a full snapshot.
      raceTickOnly =
        due.length > 0 &&
        due.every((job) => job.payload === "kart-tick") &&
        after.phase === "collect" &&
        after.phaseGeneration === before.phaseGeneration &&
        after.questionIndex === before.questionIndex &&
        !after.paused &&
        !after.hold;
    });
    await settleArchive({
      storage: this.ctx.storage,
      env: this.env,
      now,
      ...(this.archiveWriterOverride ? { writer: this.archiveWriterOverride } : {}),
    });
    if (!raceTickOnly || !this.broadcastKart()) {
      this.broadcast(true);
    }
  }

  /** Tests inject a writer. Production uses the Worker database binding. */
  useArchiveWriter(writer: ArchiveWriter | undefined): void {
    this.archiveWriterOverride = writer;
  }

  /** Tests inject a sender. Local play writes the room outbox. */
  useEmailSender(sender: EmailSender | undefined): void {
    this.emailSenderOverride = sender;
  }

  archivePublicStatus(): { state: "unknown" | "preparing" | "ready" } {
    if (!this.readRoom()) {
      return { state: "unknown" };
    }
    const archive = readRoomArchive(this.ctx.storage.sql);
    if (!archive) {
      return { state: "unknown" };
    }
    if (archive.status === "completed") {
      return { state: "ready" };
    }
    return { state: "preparing" };
  }

  async publishedResults(): Promise<PublicResults> {
    const status = this.archivePublicStatus();
    if (status.state !== "ready") {
      return status;
    }
    const room = this.readRoom();
    if (!room) {
      return { state: "unknown" };
    }
    try {
      const published = await (await this.resultsWriter()).readPublic(room.game_id);
      if (!published) {
        return { state: "preparing" };
      }
      return toPublicResults(published);
    } catch {
      return { state: "preparing" };
    }
  }

  async ownResults(
    playerId: string,
    secret: string,
    nowMs: number,
  ): Promise<
    | { ok: true; result: PersonalResults }
    | {
        ok: false;
        error: "unauthenticated" | "forbidden" | "not_found";
        message: string;
      }
  > {
    const guest = await this.requireMediaGuest(playerId, secret, nowMs);
    if (!guest.ok) {
      return guest;
    }
    const result = await this.personalFor(playerId);
    if (!result) {
      return {
        ok: false,
        error: "not_found",
        message: "Your result is not in this archive.",
      };
    }
    return { ok: true, result };
  }

  async grantResults(
    token: string,
    nowMs: number,
  ): Promise<
    | { ok: true; result: PersonalResults }
    | { ok: false; error: "invalid" | "expired" | "not_found"; message: string }
  > {
    const delivery = await this.resultsDelivery();
    const found = await personalFromGrant({
      store: delivery.store,
      token,
      nowMs,
    });
    if (found === "expired") {
      return {
        ok: false,
        error: "expired",
        message: "This personal link has expired.",
      };
    }
    if (typeof found === "string") {
      return {
        ok: false,
        error: "invalid",
        message: "This personal link is not valid.",
      };
    }
    const result = await this.personalFor(found.grant.playerId);
    if (!result) {
      return {
        ok: false,
        error: "not_found",
        message: "Your result is not in this archive.",
      };
    }
    return { ok: true, result };
  }

  async requestOwnEmail(input: {
    playerId: string;
    secret: string;
    email: string;
    nowMs: number;
    origin: string;
  }): Promise<
    | { ok: true; status: "sent" | "uncertain" | "failed" | "invalid" }
    | {
        ok: false;
        error: "unauthenticated" | "forbidden" | "invalid" | "not_found";
        message: string;
      }
  > {
    const guest = await this.requireMediaGuest(
      input.playerId,
      input.secret,
      input.nowMs,
    );
    if (!guest.ok) {
      return guest;
    }
    if (this.archivePublicStatus().state !== "ready") {
      return {
        ok: false,
        error: "invalid",
        message: "Results are still being stored.",
      };
    }
    const delivery = await this.resultsDelivery();
    const room = this.readRoom();
    if (!room) {
      return {
        ok: false,
        error: "invalid",
        message: "Results are still being stored.",
      };
    }
    const status = await startVerification({
      store: delivery.store,
      sender: delivery.sender,
      gameId: room.game_id,
      playerId: input.playerId,
      email: input.email,
      nowMs: input.nowMs,
      origin: input.origin,
    });
    if (status === "expired") {
      return { ok: true, status: "failed" };
    }
    return { ok: true, status };
  }

  async confirmOwnEmail(input: {
    token: string;
    nowMs: number;
    origin: string;
  }): Promise<{
    ok: true;
    status: "sent" | "uncertain" | "failed" | "expired" | "invalid";
  }> {
    const delivery = await this.resultsDelivery();
    const hashed = await hashCredentialSecret(input.token);
    const grant = await delivery.store.findGrantByHash(hashed);
    if (!grant || grant.purpose !== "verify") {
      return { ok: true, status: "invalid" };
    }
    const personal = await this.personalFor(grant.playerId);
    if (!personal) {
      return { ok: true, status: "invalid" };
    }
    const status = await confirmVerification({
      store: delivery.store,
      sender: delivery.sender,
      token: input.token,
      nowMs: input.nowMs,
      origin: input.origin,
      personal,
    });
    return { ok: true, status };
  }

  async listLocalOutbox(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
  }): Promise<
    | {
        ok: true;
        messages: {
          recipient: string;
          subject: string;
          text: string;
          idempotencyKey: string | null;
        }[];
      }
    | { ok: false; error: "unauthenticated" | "not_found"; message: string }
  > {
    if (this.env.APP_ENV !== "local") {
      return { ok: false, error: "not_found", message: roomMissingMessage };
    }
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return { ok: false, error: "unauthenticated", message: allowed.message };
    }
    return { ok: true, messages: listSqliteOutbox(this.ctx.storage.sql) };
  }

  readGalleryMedia(
    mediaId: string,
  ):
    | { ok: true; finalKey: string; contentType: string }
    | { ok: false; reason: "hidden" | "missing" } {
    const row = readServable(this.ctx.storage.sql, mediaId);
    if (!row) {
      return { ok: false, reason: "missing" };
    }
    if (row.hidden) {
      return { ok: false, reason: "hidden" };
    }
    return { ok: true, finalKey: row.finalKey, contentType: row.contentType };
  }

  async startFixture(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
    includeVote?: boolean;
    durations?: Partial<Record<RoomPhase, number>>;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "start-fixture" }, (sql) => {
      startRound(
        createSqlStore(sql),
        input.nowMs,
        fixturePlugin({
          includeVote: input.includeVote,
          durations: input.durations,
        }),
        crypto.randomUUID(),
      );
    });
  }

  async pauseRound(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "pause" }, (sql) => {
      const store = createSqlStore(sql);
      const question = questionFor(store.readRoom());
      if (question?.kind === "kart")
        releaseKartInputs(sql, store, question, input.nowMs);
      pause(store, input.nowMs);
    });
  }

  async resumeRound(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "resume" }, (sql) => {
      resume(createSqlStore(sql), input.nowMs);
    });
  }

  async advanceRound(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "advance" }, (sql) => {
      advance(createGameStore(sql), input.nowMs);
    });
  }

  async startDemo(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "start-demo" }, (sql) => {
      sql.exec(
        `UPDATE room SET question_set_version = ?, scoring_version = ?, opening = 'done'`,
        demoQuestionSetVersion,
        demoScoringVersion,
      );
      startRound(
        createGameStore(sql),
        input.nowMs,
        multipleChoicePlugin(),
        crypto.randomUUID(),
      );
    });
  }

  async startKartRehearsal(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) return allowed;
    if (this.env.APP_ENV !== "local")
      return {
        ok: false,
        error: "forbidden",
        message: "Kart rehearsal is available only in local development.",
      };
    return this.phaseCommand(
      input.requestId,
      { action: "start-kart-rehearsal" },
      (sql) => {
        const pack = requireKartRehearsal(kartRehearsalVersion);
        sql.exec(
          "UPDATE room SET question_set_version = ?, scoring_version = ?, opening = 'done'",
          kartRehearsalVersion,
          demoScoringVersion,
        );
        startRound(
          createGameStore(sql),
          input.nowMs,
          {
            ...multipleChoicePlugin(),
            questionCount: pack.questions.length,
            collectWindows: pack.questions.map((q) => q.collectMs),
          },
          crypto.randomUUID(),
        );
      },
    );
  }

  async skipRound(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "skip" }, (sql) => {
      if (!skipQuestion(createGameStore(sql), input.nowMs)) {
        throw new Error(skipClosedMessage);
      }
    });
  }

  async finishRound(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return this.phaseCommand(input.requestId, { action: "finish" }, (sql) => {
      if (!finishGame(createGameStore(sql), input.nowMs)) {
        throw new Error(finishClosedMessage);
      }
    });
  }

  async hostAction(input: {
    credentialId: string;
    secret: string;
    requestId: string;
    nowMs: number;
    action: string;
    playerId?: string;
    otherPlayerId?: string;
    nickname?: string;
    points?: number;
    reason?: string;
    candidateId?: string;
    effectId?: string;
    mediaId?: string;
    trollKind?: TrollKindName;
    postId?: string;
    wallSettings?: WallSettingsChange;
  }): Promise<PhaseCommandResult> {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    const payload: Record<string, string | number> = { action: input.action };
    if (input.playerId) {
      payload.playerId = input.playerId;
    }
    if (input.otherPlayerId) {
      payload.otherPlayerId = input.otherPlayerId;
    }
    if (input.nickname) {
      payload.nickname = input.nickname;
    }
    if (input.points !== undefined) {
      payload.points = input.points;
    }
    if (input.reason) {
      payload.reason = input.reason;
    }
    if (input.candidateId) {
      payload.candidateId = input.candidateId;
    }
    if (input.effectId) {
      payload.effectId = input.effectId;
    }
    if (input.mediaId) {
      payload.mediaId = input.mediaId;
    }
    if (input.trollKind) {
      payload.trollKind = input.trollKind;
    }
    if (input.postId) {
      payload.postId = input.postId;
    }
    if (input.wallSettings) {
      payload.wallSettings = JSON.stringify(input.wallSettings);
    }
    let transfer: HostActionInput["transfer"];
    if (input.action === "recover") {
      const code = randomToken(8);
      transfer = {
        code,
        codeHash: await hashCredentialSecret(code),
        expiresAt: new Date(input.nowMs + transferTtlMs).toISOString(),
      };
    }
    let transferCode: string | undefined;
    let released: number | undefined;
    let retried: number | undefined;
    if (
      input.action === "retry-delivery" &&
      !this.readReceipt("control", input.requestId)
    ) {
      const delivery = await this.resultsDelivery();
      const room = this.readRoom();
      retried = room
        ? await retryStoredDeliveries(
            delivery.store,
            delivery.sender,
            room.game_id,
            input.nowMs,
          )
        : 0;
    }
    const result = await this.phaseCommand(
      input.requestId,
      payload,
      (sql) => {
        if (input.action === "retry-delivery") {
          return;
        }
        const applied = applyHostAction(sql, {
          action: input.action,
          playerId: input.playerId,
          otherPlayerId: input.otherPlayerId,
          nickname: input.nickname,
          points: input.points,
          reason: input.reason,
          candidateId: input.candidateId,
          effectId: input.effectId,
          mediaId: input.mediaId,
          trollKind: input.trollKind,
          postId: input.postId,
          wallSettings: input.wallSettings,
          now: new Date(input.nowMs).toISOString(),
          nowMs: input.nowMs,
          transfer,
        });
        transferCode = applied.transferCode;
        released = applied.released;
      },
      () => ({
        ...(transferCode ? { transferCode } : {}),
        ...(released !== undefined ? { released } : {}),
        ...(retried !== undefined ? { retried } : {}),
      }),
    );
    if (result.ok && input.action === "kick" && input.playerId) {
      this.closePlayerSockets(input.playerId, removedSessionMessage);
    }
    return result;
  }

  async adminMediaPage(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
    before?: number;
  }) {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) return allowed;
    return { ok: true as const, page: adminMedia(this.ctx.storage.sql, input.before) };
  }

  async diagnostics(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
  }): Promise<
    | { ok: true; report: ReturnType<typeof readRoomDiagnostics> }
    | Extract<PhaseCommandResult, { ok: false }>
  > {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    const delivery = await this.deliveryCounts();
    const alarmAt = await this.ctx.storage.getAlarm();
    const report = readRoomDiagnostics(this.ctx.storage.sql, {
      alarmAt,
      connections: {
        guests: this.ctx.getWebSockets("guest").length,
        stage: this.ctx.getWebSockets("presentation").length,
        control: this.ctx.getWebSockets("control").length,
      },
      delivery,
      realtime: this.meter.summary(Date.now()),
    });
    return { ok: true, report };
  }

  async scoreSummary(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
  }): Promise<
    { ok: true; markdown: string } | Extract<PhaseCommandResult, { ok: false }>
  > {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    return { ok: true, markdown: scoreSummaryMarkdown(this.ctx.storage.sql) };
  }

  async seedDemoCloud(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
    target: number;
  }): Promise<
    { ok: true; count: number } | Extract<PhaseCommandResult, { ok: false }>
  > {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    let count = 0;
    await commitAndArm(this.ctx.storage, (sql) => {
      count = seedDemoNames(sql, input.target, new Date(input.nowMs).toISOString());
      sql.exec(`UPDATE room SET state_version = state_version + 1`);
    });
    this.broadcast();
    return { ok: true, count };
  }

  /** Fills an empty room with sample data for previewing the admin pages. */
  async seedSample(input: {
    credentialId: string;
    secret: string;
    nowMs: number;
    media: SampleMedia[];
  }): Promise<
    { ok: true; count: number } | Extract<PhaseCommandResult, { ok: false }>
  > {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      input.nowMs,
    );
    if (!allowed.ok) {
      return allowed;
    }
    let count = 0;
    try {
      await commitAndArm(this.ctx.storage, (sql) => {
        count = seedSampleRoom(sql, input.media, input.nowMs);
      });
    } catch (error) {
      return {
        ok: false,
        error: "invalid",
        message: error instanceof Error ? error.message : roundStartMessage,
      };
    }
    this.broadcast();
    return { ok: true, count };
  }

  async scoreRecord(): Promise<{ total: number; rows: number }> {
    return {
      total: ledgerTotal(this.ctx.storage.sql),
      rows: ledgerCount(this.ctx.storage.sql),
    };
  }

  async rescoreCurrent(): Promise<{ total: number; rows: number }> {
    let total = 0;
    let rows = 0;
    await commitAndArm(this.ctx.storage, (sql) => {
      const room = createSqlStore(sql).readRoom();
      recordRevealScores(sql, room, Date.now());
      total = ledgerTotal(sql);
      rows = ledgerCount(sql);
    });
    return { total, rows };
  }

  async acceptFixtureAnswer(input: {
    playerId: string;
    nowMs: number;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    if (
      !this.readPlayer(input.playerId) ||
      this.readPlayer(input.playerId)?.revoked_at
    ) {
      return { ok: false, message: playerMissingMessage };
    }
    let result: { ok: true } | { ok: false; message: string } = { ok: true };
    await commitAndArm(this.ctx.storage, (sql) => {
      const accepted = acceptAnswer(createSqlStore(sql), input.playerId, input.nowMs);
      result = accepted.ok
        ? { ok: true }
        : { ok: false, message: answerMessage(accepted.reason) };
    });
    return result;
  }

  async reserveMedia(input: {
    playerId: string;
    secret: string;
    requestId: string;
    kind: "photo" | "voice";
    purpose?: MediaPurpose;
    nowMs: number;
  }) {
    const guest = await this.requireMediaGuest(
      input.playerId,
      input.secret,
      input.nowMs,
    );
    if (!guest.ok) {
      return guest;
    }
    return this.ctx.storage.transactionSync(() =>
      reserveUpload(this.ctx.storage.sql, {
        playerId: input.playerId,
        requestId: input.requestId,
        kind: input.kind,
        ...(input.purpose ? { purpose: input.purpose } : {}),
        nowMs: input.nowMs,
      }),
    );
  }

  async claimMedia(input: {
    playerId: string;
    secret: string;
    uploadId: string;
    nowMs: number;
  }) {
    const guest = await this.requireMediaGuest(
      input.playerId,
      input.secret,
      input.nowMs,
    );
    if (!guest.ok) {
      return guest;
    }
    return this.ctx.storage.transactionSync(() =>
      claimUpload(this.ctx.storage.sql, {
        playerId: input.playerId,
        uploadId: input.uploadId,
        nowMs: input.nowMs,
      }),
    );
  }

  async rememberMediaSource(uploadId: string, etag: string): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      rememberSource(this.ctx.storage.sql, uploadId, etag);
    });
  }

  async clearMediaSource(uploadId: string): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      clearPrepared(this.ctx.storage.sql, uploadId);
    });
  }

  async stageMedia(input: {
    uploadId: string;
    byteLength: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    contentType: string;
  }): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      stageUpload(this.ctx.storage.sql, input);
    });
  }

  async commitMedia(input: { uploadId: string }) {
    const result = this.ctx.storage.transactionSync(() =>
      commitUpload(this.ctx.storage.sql, input),
    );
    if (result.ok && !result.repeated && result.kind === "photo") {
      const nickname = this.ctx.storage.sql
        .exec<{ nickname: string }>(
          `SELECT p.nickname FROM media_upload m
           JOIN player p ON p.player_id = m.player_id
           WHERE m.media_id = ? AND m.purpose = 'round'`,
          result.mediaId,
        )
        .toArray()[0]?.nickname;
      if (nickname) {
        await commitAndArm(this.ctx.storage, (sql) => {
          enqueuePhotoCue(sql, result.mediaId, nickname, Date.now());
        });
      }
    }
    if (result.ok) {
      this.broadcast();
    }
    return result;
  }

  async releaseMedia(uploadId: string): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      releaseUpload(this.ctx.storage.sql, uploadId);
    });
  }

  async rejectMedia(uploadId: string, message: string): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      rejectUpload(this.ctx.storage.sql, uploadId, message);
    });
  }

  async prepareMediaWrite(input: {
    playerId: string;
    secret: string;
    uploadId: string;
    nowMs: number;
  }) {
    const guest = await this.requireMediaGuest(
      input.playerId,
      input.secret,
      input.nowMs,
    );
    if (!guest.ok) {
      return guest;
    }
    return this.ctx.storage.transactionSync(() =>
      temporaryWrite(this.ctx.storage.sql, {
        playerId: input.playerId,
        uploadId: input.uploadId,
        nowMs: input.nowMs,
      }),
    );
  }

  async readMedia(input: {
    mediaId: string;
    nowMs: number;
    guest?: { playerId: string; secret: string };
    credential?: {
      credentialId: string;
      secret: string;
      role: "control" | "presentation";
    };
  }) {
    if (input.guest) {
      const guest = await this.requireMediaGuest(
        input.guest.playerId,
        input.guest.secret,
        input.nowMs,
      );
      if (!guest.ok) {
        return guest;
      }
    } else if (input.credential) {
      const allowed = await this.requireCredential(
        input.credential.role,
        input.credential.credentialId,
        input.credential.secret,
        input.nowMs,
      );
      if (!allowed.ok) {
        return allowed;
      }
    } else {
      return {
        ok: false as const,
        error: "unauthenticated" as const,
        message: mediaMissingMessage,
      };
    }
    const row = readServable(this.ctx.storage.sql, input.mediaId);
    const wallHidden =
      row?.purpose === "wall" &&
      !wallMediaViewable(
        this.ctx.storage.sql,
        input.mediaId,
        input.guest
          ? { role: "guest", playerId: input.guest.playerId }
          : { role: input.credential?.role === "control" ? "control" : "presentation" },
      );
    if (!row || row.hidden || wallHidden) {
      return {
        ok: false as const,
        error: "not_found" as const,
        message: mediaMissingMessage,
      };
    }
    return { ok: true as const, finalKey: row.finalKey, contentType: row.contentType };
  }

  async snapshotFor(
    audience: "guest" | "stage" | "control",
    principalId?: string,
  ): Promise<LobbySnapshot> {
    const self = audience === "guest" ? principalId : undefined;
    return this.buildSnapshot(audience, self);
  }

  // Only the authenticated Worker routes call these RPCs; they never accept
  // administrator claims from a guest or a WebSocket message.
  async adminRoom(input: { credentialId: string; secret: string; now: string }) {
    const allowed = await this.requireControl(
      input.credentialId,
      input.secret,
      Date.parse(input.now),
    );
    if (!allowed.ok) return allowed;
    return { ok: true as const, snapshot: this.buildSnapshot("control") };
  }

  async resumeAdmin(input: { requestId: string; now: string }) {
    if (!this.readRoom())
      return { ok: false as const, error: "not_found", message: roomMissingMessage };
    const principal = "admin-resume";
    const digest = await payloadDigest({ action: "resume-admin" });
    const prior = this.readReceipt(principal, input.requestId);
    if (prior) {
      const saved = JSON.parse(prior.resultJson) as {
        control: CredentialSecrets;
        presentation: CredentialSecrets;
      };
      const allowed = await this.requireControl(
        saved.control.credentialId,
        saved.control.secret,
        Date.parse(input.now),
      );
      if (!allowed.ok)
        return {
          ok: false as const,
          error: "expired",
          message: "That opening request expired. Try opening the room again.",
        };
      return { ok: true as const, ...saved, snapshot: this.buildSnapshot("control") };
    }
    const control = await this.prepareCredential("control", new Date(input.now));
    const presentation = await this.prepareCredential(
      "presentation",
      new Date(input.now),
    );
    const saved = {
      control: publicSecret(control),
      presentation: publicSecret(presentation),
    };
    this.ctx.storage.transactionSync(() => {
      // A concurrent retry may have completed while hashing credentials.
      if (this.readReceipt(principal, input.requestId)) return;
      for (const [role, value] of [
        ["control", control],
        ["presentation", presentation],
      ] as const) {
        insertCredential(this.ctx.storage.sql, {
          id: value.credentialId,
          principal: role,
          playerId: null,
          secretHash: value.secretHash,
          expiresAt: value.expiresAt,
        });
      }
      this.writeReceipt(principal, input.requestId, digest, saved);
      this.writeAudit("admin_room_resumed", "control", input.now, {});
    });
    const persisted = JSON.parse(
      this.readReceipt(principal, input.requestId)!.resultJson,
    ) as typeof saved;
    return { ok: true as const, ...persisted, snapshot: this.buildSnapshot("control") };
  }

  async releaseAdmin(input: {
    credentialId: string;
    secret: string;
    now: string;
    role: RoomCredentialRole;
  }) {
    const allowed = await this.requireCredential(
      input.role,
      input.credentialId,
      input.secret,
      Date.parse(input.now),
    );
    if (!allowed.ok) return;
    await createSqliteRoomCredentialDirectory(this.ctx.storage.sql).revoke(
      input.credentialId,
      input.now,
    );
    for (const socket of this.ctx.getWebSockets(input.role)) {
      if (this.attachment(socket)?.principalId !== input.credentialId) continue;
      const message =
        "Room access changed in this browser. Reopen the room from admin.";
      this.send(socket, { kind: "replaced", scope: "private", message });
      socket.close(4000, message);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return roomResponse(404, "not_found", roomMissingMessage);
    }
    if (rejectUnlessClientApiKey(request, this.env)) {
      return roomResponse(403, "forbidden", "Open this game from the same site.");
    }
    if (sameOriginRejection(request)) {
      return roomResponse(403, "forbidden", "Open this game from the same site.");
    }
    const room = this.readRoom();
    if (!room) {
      return roomResponse(404, "not_found", roomMissingMessage);
    }
    const query = new URL(request.url).searchParams;
    const role = query.get("role");
    const since = query.get("since");
    const identity = await this.identify(request, room.game_id, role, new Date());
    if (!identity.ok) {
      return roomResponse(identity.status, identity.error, identity.message);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [identity.attachment.role]);
    server.serializeAttachment(
      query.get("patches") === "1"
        ? { ...identity.attachment, patches: true }
        : identity.attachment,
    );
    if (identity.attachment.role === "guest") {
      this.closeOlder(server, identity.attachment, newerTabMessage);
    } else if (identity.attachment.role === "presentation") {
      this.closeOlder(server, identity.attachment, newerTabMessage);
    }
    if (identity.attachment.role === "guest") {
      this.ctx.storage.transactionSync(() => {
        noteGuestSocket(this.ctx.storage.sql, identity.attachment.principalId);
      });
    }
    // Resume: a screen that still holds the last view this room sent it gets
    // only what changed since, instead of the whole room again.
    const resumed =
      since && query.get("patches") === "1"
        ? this.lastViews.get(viewKey(identity.attachment))
        : undefined;
    if (resumed && resumed.id === since) {
      this.views.set(server, resumed);
    }
    await this.refreshPresence();
    this.sendSnapshot(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    const bytes = typeof message === "string" ? text.length : message.byteLength;
    this.meter.add("in", bytes, Date.now());
    if (bytes > maxPayloadBytes) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId: "",
        accepted: false,
        error: messageLimitMessage,
      });
      return;
    }
    const attachment = this.attachment(ws);
    if (!attachment) {
      return;
    }
    if (text === "ping") {
      return;
    }
    if (text.startsWith("time:")) {
      // Clock sample for the screen's countdown. The reply goes straight out:
      // it needs no delivery number and no snapshot.
      const sentAt = Number(text.slice(5));
      if (
        Number.isFinite(sentAt) &&
        this.allow(`time:${attachment.principalId}`, timeRateLimit)
      ) {
        const reply = JSON.stringify({ kind: "time", sentAt, serverNow: Date.now() });
        this.meter.add("out:time", reply.length, Date.now());
        try {
          ws.send(reply);
        } catch {
          // The screen already left.
        }
      }
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const early = parsed === undefined ? null : readCommand(parsed);
    if (early && (early.name === "device" || early.name === "connection")) {
      if (attachment.role === "guest") {
        this.acceptTelemetry(ws, attachment.principalId, early);
      } else {
        this.send(ws, {
          kind: "ack",
          scope: "private",
          requestId: early.requestId,
          accepted: true,
        });
      }
      return;
    }
    if (early?.name === "kart-input") {
      if (attachment.role !== "guest") return;
      // Controls carry no acknowledgement. They are stored, with their arrival
      // time, in one transaction at the start of the next tick.
      const sql = this.ctx.storage.sql;
      const room = createSqlStore(sql).readRoom();
      if (room.phase !== "collect" || room.paused || room.hold) return;
      const question = questionFor(room);
      if (question?.kind !== "kart") return;
      const session = readRoundState<{ raceId: string; players: string[] }>(
        sql,
        question.id,
        "kart-session",
      );
      if (!session?.players.includes(attachment.principalId)) return;
      if (
        !early.input ||
        typeof early.input !== "object" ||
        (early.input as { raceId?: unknown }).raceId !== session.raceId
      )
        return;
      this.kartArrivals.push(attachment.principalId, early.input, Date.now());
      return;
    }
    const command = early;
    if (command?.name === "draft") {
      // A dropped draft only delays the stage preview. It has no reply.
      if (
        attachment.role === "guest" &&
        this.allow(`draft:${attachment.principalId}`, draftRateLimit)
      ) {
        this.noteLiveDraft(attachment.principalId, command.text);
      }
      return;
    }
    if (!this.allow(`command:${attachment.principalId}`, commandRateLimit)) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId: command?.requestId ?? "",
        accepted: false,
        error: messageLimitMessage,
      });
      return;
    }
    if (!command) {
      return;
    }
    if (command.name === "kart-recover" || command.name === "kart-use-item") {
      await this.acceptKartAction(
        ws,
        attachment,
        command.requestId,
        command.raceId,
        command.name,
      );
      return;
    }
    if (command.name === "answer") {
      await this.acceptGuestChoice(ws, attachment, command.requestId, command.optionId);
      return;
    }
    if (command.name === "estimate") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "estimate",
        value: command.value,
      });
      return;
    }
    if (command.name === "rank") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "rank",
        placements: command.placements,
      });
      return;
    }
    if (command.name === "text") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "text",
        body: command.body,
      });
      return;
    }
    if (command.name === "ballot") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "ballot",
        candidateId: command.candidateId,
        ...(command.epoch === undefined ? {} : { epoch: command.epoch }),
      });
      return;
    }
    if (command.name === "duel") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "duel",
        value: command.value,
      });
      return;
    }
    if (command.name === "troll") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "troll",
        kind: command.kind,
        targetId: command.targetId,
        ...(command.mediaId ? { mediaId: command.mediaId } : {}),
      });
      return;
    }
    if (command.name === "troll-escape") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "troll-escape",
        effectId: command.effectId,
      });
      return;
    }
    if (command.name === "wall-post") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "wall-post",
        mediaId: command.mediaId,
        caption: command.caption,
        frame: command.frame,
        keep: command.keep,
      });
      return;
    }
    if (command.name === "wall-withdraw") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "wall-withdraw",
        postId: command.postId,
      });
      return;
    }
    if (command.name === "wall-react") {
      await this.acceptGuestValue(ws, attachment, command.requestId, {
        name: "wall-react",
        postId: command.postId,
        reaction: command.reaction,
      });
      return;
    }
    if (command.name === "react") {
      await this.acceptReaction(
        ws,
        attachment,
        command.requestId,
        command.targetId,
        command.reaction,
      );
      return;
    }
    if (command.name === "driver") {
      await this.acceptDriver(ws, attachment, command.requestId, {
        style: command.style,
        faceMediaId: command.faceMediaId,
      });
      return;
    }
    const digest = await payloadDigest({ name: command.name });
    const prior = this.readReceipt(attachment.principalId, command.requestId);
    if (prior && prior.digest !== digest) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId: command.requestId,
        accepted: false,
        error: digestMismatchMessage,
      });
      return;
    }
    if (!prior) {
      this.ctx.storage.transactionSync(() => {
        if (!this.readReceipt(attachment.principalId, command.requestId)) {
          this.writeReceipt(attachment.principalId, command.requestId, digest, {
            accepted: true,
            name: command.name,
          });
        }
      });
    }
    this.sendSnapshot(ws);
    this.send(ws, {
      kind: "ack",
      scope: "private",
      requestId: command.requestId,
      accepted: true,
    });
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    void code;
    void reason;
    void wasClean;
    const attachment = this.attachment(ws);
    if (
      attachment?.role === "guest" &&
      this.liveDrafts.delete(attachment.principalId)
    ) {
      this.broadcastStage();
    }
    await this.refreshPresence(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    void ws;
    void error;
  }

  readGameplayContext(playerId: string) {
    return readTelemetry(this.ctx.storage.sql, playerId);
  }

  async configureTelemetryRetention(days: number): Promise<void> {
    await commitAndArm(this.ctx.storage, (sql) => {
      configureTelemetryRetention(sql, days, Date.now());
    });
  }

  private acceptTelemetry(
    ws: WebSocket,
    playerId: string,
    command:
      | { requestId: string; name: "device"; reason: string; report: unknown }
      | {
          requestId: string;
          name: "connection";
          rttMs: unknown;
          submissionRetries: unknown;
          uploadAttempts: unknown;
          uploadFailures: unknown;
          uploadDurationMs: unknown;
          scriptErrors?: unknown;
          lastScriptError?: unknown;
        },
  ): void {
    if (!this.allow(`telemetry:${playerId}`, telemetryRateLimit)) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId: command.requestId,
        accepted: true,
      });
      return;
    }
    try {
      this.ctx.storage.transactionSync(() => {
        if (command.name === "device") {
          acceptDeviceReport(
            this.ctx.storage.sql,
            playerId,
            command.report,
            command.reason,
            Date.now(),
          );
          return;
        }
        mergeConnectionSummary(this.ctx.storage.sql, playerId, command);
      });
    } catch {
      // A bad statistics report must not affect the game.
    }
    this.send(ws, {
      kind: "ack",
      scope: "private",
      requestId: command.requestId,
      accepted: true,
    });
  }

  private async phaseCommand(
    requestId: string,
    payload: Record<string, string | number>,
    apply: (sql: SqlStorage) => void,
    extra?: () => {
      transferCode?: string;
      released?: number;
      retried?: number;
    },
  ): Promise<PhaseCommandResult> {
    if (!validRequestId(requestId)) {
      return { ok: false, error: "invalid", message: roundStartMessage };
    }
    const digest = await payloadDigest(payload);
    const prior = this.readReceipt("control", requestId);
    if (prior) {
      return this.replay<PhaseCommandResult>(prior, digest);
    }
    let result: PhaseCommandResult = {
      ok: false,
      error: "invalid",
      message: roundStartMessage,
    };
    try {
      await commitAndArm(this.ctx.storage, (sql) => {
        const again = this.readReceipt("control", requestId);
        if (again) {
          result = this.replay<PhaseCommandResult>(again, digest);
          return;
        }
        this.flushKartInputs(sql);
        apply(sql);
        const clock = publicClock(createSqlStore(sql));
        result = {
          ok: true,
          phase: clock.phase,
          paused: clock.paused,
          held: clock.held,
          stateVersion: this.readRoom()?.state_version ?? 0,
          ...extra?.(),
        };
        this.writeReceipt("control", requestId, digest, result);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : roundStartMessage;
      return { ok: false, error: "invalid", message };
    }
    this.broadcast();
    return result;
  }

  private async acceptKartAction(
    ws: WebSocket,
    attachment: SocketAttachment,
    requestId: string,
    raceId: string,
    action: "kart-recover" | "kart-use-item" = "kart-recover",
  ): Promise<void> {
    if (attachment.role !== "guest") {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: "Only a racing phone can use kart actions.",
      });
      return;
    }
    const digest = await payloadDigest({ name: action, raceId });
    let result: { accepted: boolean; error?: string } = { accepted: false };
    await commitAndArm(this.ctx.storage, (sql) => {
      const prior = this.readReceipt(attachment.principalId, requestId);
      if (prior) {
        result =
          prior.digest === digest
            ? JSON.parse(prior.resultJson)
            : {
                accepted: false,
                error: "That request id was already used for another action.",
              };
        return;
      }
      this.flushKartInputs(sql);
      const store = createSqlStore(sql),
        q = questionFor(store.readRoom());
      const recovered =
        q?.kind === "kart"
          ? (action === "kart-recover" ? recoverKart : useKartItem)(
              sql,
              store,
              q,
              attachment.principalId,
              raceId,
              Date.now(),
            )
          : { ok: false as const, message: "No kart race is running." };
      result = recovered.ok
        ? { accepted: true }
        : { accepted: false, error: recovered.message };
      if (recovered.ok && action === "kart-recover")
        this.kartArrivals.discard(attachment.principalId);
      this.writeReceipt(attachment.principalId, requestId, digest, result);
    });
    this.sendSnapshot(ws);
    if (result.accepted) this.broadcastKart();
    this.send(ws, { kind: "ack", scope: "private", requestId, ...result });
  }

  private flushKartInputs(sql: SqlStorage): void {
    const arrivals = this.kartArrivals.drain();
    if (!arrivals.length) return;
    const store = createSqlStore(sql);
    const question = questionFor(store.readRoom());
    if (question?.kind === "kart") acceptKartInputs(sql, store, arrivals, question);
  }

  private async requireControl(
    credentialId: string,
    secret: string,
    nowMs: number,
  ): Promise<{ ok: true } | Extract<PhaseCommandResult, { ok: false }>> {
    const room = this.readRoom();
    if (!room) {
      return { ok: false, error: "unauthenticated", message: roomMissingMessage };
    }
    const record = await createSqliteRoomCredentialDirectory(this.ctx.storage.sql).get(
      credentialId,
    );
    if (!record) {
      return { ok: false, error: "unauthenticated", message: controlMissingMessage };
    }
    const check = await verifyRoomCredential({
      credentialId,
      secret,
      record,
      now: new Date(nowMs),
      roomId: room.game_id,
      role: "control",
    });
    if (!check.ok) {
      const forbidden = check.reason === "wrong_role" || check.reason === "wrong_room";
      return {
        ok: false,
        error: forbidden ? "forbidden" : "unauthenticated",
        message: controlMissingMessage,
      };
    }
    return { ok: true };
  }

  private async requireCredential(
    role: "control" | "presentation",
    credentialId: string,
    secret: string,
    nowMs: number,
  ): Promise<
    | { ok: true }
    | { ok: false; error: "unauthenticated" | "forbidden"; message: string }
  > {
    const room = this.readRoom();
    if (!room) {
      return { ok: false, error: "unauthenticated", message: roomMissingMessage };
    }
    const record = await createSqliteRoomCredentialDirectory(this.ctx.storage.sql).get(
      credentialId,
    );
    if (!record) {
      return { ok: false, error: "unauthenticated", message: controlMissingMessage };
    }
    const check = await verifyRoomCredential({
      credentialId,
      secret,
      record,
      now: new Date(nowMs),
      roomId: room.game_id,
      role,
    });
    if (!check.ok) {
      const forbidden = check.reason === "wrong_role" || check.reason === "wrong_room";
      return {
        ok: false,
        error: forbidden ? "forbidden" : "unauthenticated",
        message: controlMissingMessage,
      };
    }
    return { ok: true };
  }

  private async requireMediaGuest(playerId: string, secret: string, nowMs: number) {
    const room = this.readRoom();
    if (!room) {
      return {
        ok: false as const,
        error: "not_found" as const,
        message: roomMissingMessage,
      };
    }
    const check = await this.verifyGuest(playerId, secret, new Date(nowMs));
    if (!check.ok) {
      return {
        ok: false as const,
        error: "unauthenticated" as const,
        message: "Join this room before continuing.",
      };
    }
    const player = this.readPlayer(playerId);
    if (!player || player.revoked_at) {
      return {
        ok: false as const,
        error: "forbidden" as const,
        message: playerMissingMessage,
      };
    }
    return { ok: true as const };
  }

  private async refreshPresence(closing?: WebSocket): Promise<void> {
    if (!this.readRoom()) {
      return;
    }
    let changed = false;
    await commitAndArm(this.ctx.storage, (sql) => {
      const store = createSqlStore(sql);
      const room = store.readRoom();
      const controller = this.socketOpen("control", closing);
      const stage = this.socketOpen("presentation", closing);
      if (room.controllerPresent === controller && room.stagePresent === stage) {
        return;
      }
      changed = true;
      notePresence(store, { controller, stage }, Date.now());
    });
    // A phone coming or going changes only the host's connection counts.
    if (changed) {
      this.broadcast();
    } else {
      this.broadcastFacilitators();
    }
  }

  private socketOpen(role: SocketRole, closing?: WebSocket): boolean {
    return this.ctx.getWebSockets(role).some((socket) => {
      if (socket === closing) {
        return false;
      }
      return (
        socket.readyState !== WebSocket.CLOSING &&
        socket.readyState !== WebSocket.CLOSED
      );
    });
  }

  private async prepareCredential(
    role: RoomCredentialRole,
    now: Date,
  ): Promise<CredentialSecrets & { secretHash: string }> {
    const secret = createCredentialSecret();
    return {
      credentialId: crypto.randomUUID(),
      secret,
      secretHash: await hashCredentialSecret(secret),
      expiresAt: new Date(now.getTime() + credentialLifetimeMs(role)).toISOString(),
    };
  }

  private async identify(
    request: Request,
    gameId: string,
    role: string | null,
    now: Date,
  ): Promise<{ ok: true; attachment: SocketAttachment } | Failure> {
    const cookie = request.headers.get("cookie") ?? undefined;
    if (role === "guest") {
      const guest = readGuestCookie(cookie);
      if (!guest || guest.gameId.toUpperCase() !== gameId) {
        return denied(401, "unauthenticated", "Join this room before connecting.");
      }
      const check = await this.verifyGuest(guest.playerId, guest.secret, now);
      if (!check.ok) {
        return denied(401, "unauthenticated", "Join this room before connecting.");
      }
      return {
        ok: true,
        attachment: { role: "guest", principalId: guest.playerId, deliverySeq: 0 },
      };
    }
    if (role === "stage" || role === "control") {
      const credentialRole: RoomCredentialRole =
        role === "stage" ? "presentation" : "control";
      const presented = readCredentialCookie(cookie, credentialRole);
      if (!presented) {
        return denied(401, "unauthenticated", "This screen needs its room session.");
      }
      const record = await createSqliteRoomCredentialDirectory(
        this.ctx.storage.sql,
      ).get(presented.credentialId);
      if (!record) {
        return denied(401, "unauthenticated", "This screen needs its room session.");
      }
      const check = await verifyRoomCredential({
        credentialId: presented.credentialId,
        secret: presented.secret,
        record,
        now,
        roomId: gameId,
        role: credentialRole,
      });
      if (!check.ok) {
        const status =
          check.reason === "wrong_role" || check.reason === "wrong_room" ? 403 : 401;
        return denied(
          status,
          status === 403 ? "forbidden" : "unauthenticated",
          "This screen needs its room session.",
        );
      }
      return {
        ok: true,
        attachment: {
          role: credentialRole,
          principalId: presented.credentialId,
          deliverySeq: 0,
        },
      };
    }
    return denied(401, "unauthenticated", "This connection needs a room session.");
  }

  private async verifyGuest(playerId: string, secret: string, now: Date) {
    const row = this.ctx.storage.sql
      .exec<{ secret_hash: string; expires_at: string; revoked_at: string | null }>(
        `SELECT secret_hash, expires_at, revoked_at FROM credential
         WHERE player_id = ? AND principal = 'guest' AND revoked_at IS NULL
         ORDER BY rowid DESC LIMIT 1`,
        playerId,
      )
      .toArray()[0];
    if (!row) {
      return { ok: false as const, reason: "mismatch" as const };
    }
    return verifyGuestSecret({
      secret,
      secretHash: row.secret_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      now,
    });
  }

  private replay<T>(prior: { digest: string; resultJson: string }, digest: string): T {
    if (prior.digest !== digest) {
      return {
        ok: false,
        error: "digest_mismatch",
        message: digestMismatchMessage,
      } as T;
    }
    return JSON.parse(prior.resultJson) as T;
  }

  private async resultsWriter(): Promise<ArchiveWriter> {
    if (this.archiveWriterOverride) {
      return this.archiveWriterOverride;
    }
    return archiveWriterFor(this.env, this.ctx.storage);
  }

  private async resultsDelivery(): Promise<{
    store: ReturnType<typeof sqliteDelivery>;
    sender: EmailSender;
  }> {
    if (this.emailSenderOverride) {
      return {
        store: sqliteDelivery(this.ctx.storage.sql),
        sender: this.emailSenderOverride,
      };
    }
    const databaseUrl = presentBinding(this.env.DATABASE_URL);
    if (databaseUrl) {
      const appEnv =
        this.env.APP_ENV === "staging" || this.env.APP_ENV === "production"
          ? this.env.APP_ENV
          : "local";
      const bindings: AuthBindings = {
        APP_ENV: appEnv,
        DATABASE_URL: databaseUrl,
        RESEND_API_KEY: this.env.RESEND_API_KEY,
        RESEND_FROM: this.env.RESEND_FROM,
        EMAIL_TEST_RECIPIENT: this.env.EMAIL_TEST_RECIPIENT,
      };
      // One pool per room object. A module-wide pool would be reused by another
      // room in the same isolate, and Workers forbid I/O across objects.
      this.database ??= createDatabase(bindings).catch((error: unknown) => {
        this.database = undefined;
        throw error;
      });
      const database = await this.database;
      return {
        store: postgresDelivery(database.executor.query),
        sender: restrictResultsEmail(bindings, createEmail(bindings, database)),
      };
    }
    if (this.env.APP_ENV === "local") {
      return {
        store: sqliteDelivery(this.ctx.storage.sql),
        sender: sqliteOutbox(this.ctx.storage.sql),
      };
    }
    return {
      store: sqliteDelivery(this.ctx.storage.sql),
      sender: restrictResultsEmail(
        {
          APP_ENV: this.env.APP_ENV === "staging" ? "staging" : "production",
          EMAIL_TEST_RECIPIENT: this.env.EMAIL_TEST_RECIPIENT,
        },
        {
          kind: "unconfigured",
          async send() {
            throw new Error("Email delivery is not configured.");
          },
        },
      ),
    };
  }

  private async deliveryCounts(): Promise<
    ReturnType<typeof readRoomDiagnostics> extends never
      ? never
      : {
          available: boolean;
          pending: number;
          uncertain: number;
          failed: number;
          sent: number;
          testRecipient: boolean;
        }
  > {
    const testRecipient = Boolean(presentBinding(this.env.EMAIL_TEST_RECIPIENT));
    try {
      const delivery = await this.resultsDelivery();
      const room = this.readRoom();
      if (!room) {
        return {
          available: false,
          pending: 0,
          uncertain: 0,
          failed: 0,
          sent: 0,
          testRecipient,
        };
      }
      const counts = await delivery.store.summarise(room.game_id);
      return { available: true, ...counts, testRecipient };
    } catch {
      return {
        available: false,
        pending: 0,
        uncertain: 0,
        failed: 0,
        sent: 0,
        testRecipient,
      };
    }
  }

  private async personalFor(playerId: string): Promise<PersonalResults | null> {
    const room = this.readRoom();
    if (!room) {
      return null;
    }
    const personal = await (
      await this.resultsWriter()
    ).readPersonal(room.game_id, playerId);
    if (!personal) {
      return null;
    }
    try {
      return toPersonalResults(personal);
    } catch {
      return null;
    }
  }

  private readRoom(): RoomRow | null {
    return (
      this.ctx.storage.sql
        .exec<RoomRow>(
          `SELECT game_id, join_code, phase, question_set_version, scoring_version, state_version, created_at
           FROM room`,
        )
        .toArray()[0] ?? null
    );
  }

  private readPlayer(playerId: string) {
    return (
      this.ctx.storage.sql
        .exec<{
          player_id: string;
          nickname: string;
          revoked_at: string | null;
          device_context_id: string | null;
          device_context_version: number | null;
        }>(
          `SELECT player_id, nickname, revoked_at, device_context_id, device_context_version
           FROM player WHERE player_id = ?`,
          playerId,
        )
        .toArray()[0] ?? null
    );
  }

  private readBootstrap(): {
    control: CredentialSecrets;
    presentation: CredentialSecrets;
  } | null {
    const row = this.readReceipt("bootstrap", "credentials");
    if (!row) {
      return null;
    }
    return JSON.parse(row.resultJson) as {
      control: CredentialSecrets;
      presentation: CredentialSecrets;
    };
  }

  private toBootstrap(secrets: {
    control: CredentialSecrets;
    presentation: CredentialSecrets;
  }): LobbyBootstrap {
    const room = this.readRoom();
    if (!room) {
      throw new Error("Room bootstrap was not saved.");
    }
    return {
      gameId: room.game_id,
      joinCode: room.join_code,
      phase: "lobby",
      questionSetVersion: pinnedQuestionSetVersion,
      scoringVersion: pinnedScoringVersion,
      playerCount: this.countActivePlayers(),
      control: secrets.control,
      presentation: secrets.presentation,
    };
  }

  private countActivePlayers(): number {
    const row = this.ctx.storage.sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM player WHERE revoked_at IS NULL`,
      )
      .toArray()[0];
    return row?.total ?? 0;
  }

  private bumpState(): number {
    this.ctx.storage.sql.exec(`UPDATE room SET state_version = state_version + 1`);
    return this.readRoom()?.state_version ?? 0;
  }

  private async acceptGuestValue(
    ws: WebSocket,
    attachment: SocketAttachment,
    requestId: string,
    command:
      | { name: "estimate"; value: unknown }
      | { name: "rank"; placements: unknown }
      | { name: "text"; body: unknown }
      | { name: "ballot"; candidateId: unknown; epoch?: unknown }
      | { name: "duel"; value: unknown }
      | { name: "troll"; kind: unknown; targetId: unknown; mediaId?: string }
      | { name: "troll-escape"; effectId: unknown }
      | WallCommand,
  ): Promise<void> {
    if (attachment.role !== "guest") {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: answerRoleMessage,
      });
      return;
    }
    const digest = await payloadDigest(command);
    const prior = this.readReceipt(attachment.principalId, requestId);
    if (prior && prior.digest !== digest) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: digestMismatchMessage,
      });
      return;
    }
    if (prior) {
      const stored = JSON.parse(prior.resultJson) as {
        accepted?: boolean;
        error?: string;
      };
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: stored.accepted === true,
        error: stored.error,
      });
      return;
    }
    const player = this.readPlayer(attachment.principalId);
    if (!player || player.revoked_at) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: playerMissingMessage,
      });
      return;
    }
    const now = Date.now();
    let accepted = false;
    let error: string | undefined;
    await commitAndArm(this.ctx.storage, (sql) => {
      const again = this.readReceipt(attachment.principalId, requestId);
      if (again) {
        const stored = JSON.parse(again.resultJson) as {
          accepted?: boolean;
          error?: string;
        };
        accepted = stored.accepted === true;
        error = stored.error;
        return;
      }
      const room = createSqlStore(sql).readRoom();
      const unavailable = unavailableContentMessage(room);
      if (unavailable) {
        accepted = false;
        error = unavailable;
        this.writeReceipt(attachment.principalId, requestId, digest, {
          accepted,
          error,
          name: command.name,
        });
        return;
      }
      const question = questionFor(room);
      const result = acceptRoundCommand(
        sql,
        createSqlStore(sql),
        attachment.principalId,
        command,
        now,
        question,
      );
      accepted = result.ok;
      error = result.ok ? undefined : result.message;
      this.writeReceipt(attachment.principalId, requestId, digest, {
        accepted,
        error,
        name: command.name,
      });
    });
    this.sendSnapshot(ws);
    if (accepted) {
      if (
        command.name === "troll" ||
        command.name === "troll-escape" ||
        command.name.startsWith("wall-")
      ) {
        this.broadcast();
      } else {
        this.broadcastFacilitators();
      }
    }
    this.send(ws, {
      kind: "ack",
      scope: "private",
      requestId,
      accepted,
      error,
    });
  }

  private async acceptGuestChoice(
    ws: WebSocket,
    attachment: SocketAttachment,
    requestId: string,
    optionId: string,
  ): Promise<void> {
    if (attachment.role !== "guest") {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: answerRoleMessage,
      });
      return;
    }
    const player = this.readPlayer(attachment.principalId);
    if (!player || player.revoked_at) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: playerMissingMessage,
      });
      return;
    }
    const digest = await payloadDigest({ name: "answer", optionId });
    const prior = this.readReceipt(attachment.principalId, requestId);
    if (prior && prior.digest !== digest) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: digestMismatchMessage,
      });
      return;
    }
    if (prior) {
      const stored = JSON.parse(prior.resultJson) as {
        accepted?: boolean;
        error?: string;
      };
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: stored.accepted === true,
        error: stored.error,
      });
      return;
    }
    const now = Date.now();
    let accepted = false;
    let error: string | undefined;
    await commitAndArm(this.ctx.storage, (sql) => {
      const again = this.readReceipt(attachment.principalId, requestId);
      if (again) {
        const stored = JSON.parse(again.resultJson) as {
          accepted?: boolean;
          error?: string;
        };
        accepted = stored.accepted === true;
        error = stored.error;
        return;
      }
      const room = createSqlStore(sql).readRoom();
      const unavailable = unavailableContentMessage(room);
      if (unavailable) {
        accepted = false;
        error = unavailable;
        this.writeReceipt(attachment.principalId, requestId, digest, {
          accepted,
          error,
          name: "answer",
        });
        return;
      }
      const result = acceptChoice(
        sql,
        createSqlStore(sql),
        attachment.principalId,
        optionId,
        now,
      );
      accepted = result.ok;
      error = result.ok ? undefined : choiceMessage(result.reason);
      this.writeReceipt(attachment.principalId, requestId, digest, {
        accepted,
        error,
        name: "answer",
      });
    });
    this.sendSnapshot(ws);
    if (accepted) {
      this.broadcastFacilitators();
    }
    this.send(ws, {
      kind: "ack",
      scope: "private",
      requestId,
      accepted,
      error,
    });
  }

  /** A guest chooses their kart driver. Saved before the acknowledgement; retries reuse the receipt. */
  private async acceptDriver(
    ws: WebSocket,
    attachment: SocketAttachment,
    requestId: string,
    choice: { style: unknown; faceMediaId: unknown },
  ): Promise<void> {
    const reply = (accepted: boolean, error?: string) =>
      this.send(ws, { kind: "ack", scope: "private", requestId, accepted, error });
    if (attachment.role !== "guest") {
      reply(false, answerRoleMessage);
      return;
    }
    const digest = await payloadDigest({ name: "driver", ...choice });
    let accepted = false;
    let error: string | undefined;
    let mismatch = false;
    await commitAndArm(this.ctx.storage, (sql) => {
      const prior = this.readReceipt(attachment.principalId, requestId);
      if (prior) {
        mismatch = prior.digest !== digest;
        const stored = JSON.parse(prior.resultJson) as {
          accepted?: boolean;
          error?: string;
        };
        accepted = stored.accepted === true;
        error = stored.error;
        return;
      }
      const room = createSqlStore(sql).readRoom();
      const result = saveDriver(sql, {
        playerId: attachment.principalId,
        choice,
        phase: room.phase,
      });
      accepted = result.ok;
      error = result.ok ? undefined : result.message;
      this.writeReceipt(attachment.principalId, requestId, digest, {
        accepted,
        error,
        name: "driver",
      });
    });
    if (mismatch) {
      reply(false, digestMismatchMessage);
      return;
    }
    this.sendSnapshot(ws);
    if (accepted) {
      this.broadcast();
    }
    reply(accepted, error);
  }

  private async acceptReaction(
    ws: WebSocket,
    attachment: SocketAttachment,
    requestId: string,
    targetId: string,
    reaction: "like" | "dislike",
  ): Promise<void> {
    if (attachment.role !== "guest") {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: answerRoleMessage,
      });
      return;
    }
    const digest = await payloadDigest({ name: "react", targetId, reaction });
    const prior = this.readReceipt(attachment.principalId, requestId);
    if (prior && prior.digest !== digest) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: digestMismatchMessage,
      });
      return;
    }
    if (prior) {
      const stored = JSON.parse(prior.resultJson) as {
        accepted?: boolean;
        error?: string;
      };
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: stored.accepted === true,
        error: stored.error,
      });
      return;
    }
    const player = this.readPlayer(attachment.principalId);
    if (!player || player.revoked_at) {
      this.send(ws, {
        kind: "ack",
        scope: "private",
        requestId,
        accepted: false,
        error: playerMissingMessage,
      });
      return;
    }
    let accepted = false;
    let error: string | undefined;
    await commitAndArm(this.ctx.storage, (sql) => {
      const again = this.readReceipt(attachment.principalId, requestId);
      if (again) {
        const stored = JSON.parse(again.resultJson) as {
          accepted?: boolean;
          error?: string;
        };
        accepted = stored.accepted === true;
        error = stored.error;
        return;
      }
      const room = createSqlStore(sql).readRoom();
      const result = applyReaction(sql, {
        voterId: attachment.principalId,
        targetId,
        reaction,
        phase: room.phase,
        now: Date.now(),
      });
      accepted = result.ok;
      error = result.ok ? undefined : result.message;
      if (result.ok) {
        sql.exec(`UPDATE room SET state_version = state_version + 1`);
      }
      this.writeReceipt(attachment.principalId, requestId, digest, {
        accepted,
        error,
        name: "react",
      });
    });
    this.sendSnapshot(ws);
    if (accepted) {
      this.broadcast();
    }
    this.send(ws, {
      kind: "ack",
      scope: "private",
      requestId,
      accepted,
      error,
    });
  }

  /**
   * The parts of a snapshot that are the same for every screen of one audience.
   * A broadcast builds these once and reuses them for each socket.
   */
  private snapshotParts(audience: "guest" | "stage" | "control") {
    this.meter.add("build:public", 0, Date.now());
    const room = this.readRoom();
    if (!room) {
      throw new Error(roomMissingMessage);
    }
    const sql = this.ctx.storage.sql;
    const drivers = readDrivers(sql);
    const players = sql
      .exec<{ player_id: string; nickname: string }>(
        `SELECT player_id, nickname FROM player WHERE revoked_at IS NULL ORDER BY rowid ASC`,
      )
      .toArray()
      .map((row) => {
        const driver = drivers.get(row.player_id);
        return {
          playerId: row.player_id,
          nickname: displayNickname(sql, row.player_id, row.nickname),
          ...(driver ? { driver } : {}),
        };
      });
    const store = createSqlStore(sql);
    const presentation = sql
      .exec<{ opening: string | null; stage_hidden: number; reveal_nonce: number }>(
        `SELECT opening, stage_hidden, reveal_nonce FROM room`,
      )
      .toArray()[0];
    return {
      room,
      players,
      store,
      clock: publicClock(store),
      stored: store.readRoom(),
      presentation,
      stageHidden: presentation?.stage_hidden === 1,
      stats: readStatsSource(sql),
      cloud: cloudRows(sql),
      namesReveal: presentation?.opening === "showing" ? revealNames(sql) : null,
      media: listUploads(sql, audience),
    };
  }

  private buildSnapshot(
    audience: "guest" | "stage" | "control",
    selfPlayerId?: string,
    parts: ReturnType<PartyRoom["snapshotParts"]> = this.snapshotParts(audience),
  ): LobbySnapshot {
    const { room, players, store, clock, stored, presentation, stageHidden, stats } =
      parts;
    let play = projectPlay(
      this.ctx.storage.sql,
      stored,
      audience,
      selfPlayerId,
      audience === "stage" && stageHidden,
    );
    if (
      play &&
      audience === "guest" &&
      selfPlayerId &&
      hidesPersonalScore(this.ctx.storage.sql, selfPlayerId)
    ) {
      play = { ...play, selfAward: null, selfStanding: null };
    }
    const trolls = trollSnapshot(this.ctx.storage.sql, store, audience, selfPlayerId);
    const highlights =
      audience === "control"
        ? presentStats(stats, "preview").highlights
        : audience === "stage" && clock.phase === "podium" && !stageHidden
          ? presentStats(stats, "stage").highlights
          : undefined;
    const recap =
      audience === "guest" && selfPlayerId
        ? presentStats(stats, "recap", selfPlayerId).recap
        : undefined;
    const funFacts = readFunFactSelection(this.ctx.storage.sql);
    const factIndex =
      funFacts.cards.length === 0
        ? 0
        : Math.min(stored.funFactIndex, funFacts.cards.length - 1);
    const currentCard = funFacts.cards[factIndex];
    const currentFact = funFacts.facts[factIndex];
    const funFact =
      clock.phase === "facts" && currentCard && currentFact && audience !== "control"
        ? {
            index: factIndex,
            total: funFacts.cards.length,
            card: currentCard,
            ...(audience === "guest" && selfPlayerId
              ? { appliesToYou: funFactApplies(currentFact, selfPlayerId) }
              : {}),
          }
        : undefined;
    const funFactList =
      audience === "control" &&
      funFacts.cards.length > 0 &&
      (clock.phase === "facts" || clock.phase === "podium")
        ? {
            index: clock.phase === "facts" ? factIndex : 0,
            total: funFacts.cards.length,
            cards: funFacts.cards,
          }
        : undefined;
    return lobbySnapshotSchema.parse({
      gameId: room.game_id,
      joinCode: room.join_code,
      phase: clock.phase,
      paused: clock.paused,
      held: clock.held,
      deadlineAt: clock.deadlineAt,
      remainingMs: clock.remainingMs,
      serverNow: Date.now(),
      stateVersion: room.state_version,
      questionSetVersion: room.question_set_version,
      scoringVersion: room.scoring_version,
      players,
      ...(selfPlayerId ? { selfPlayerId } : {}),
      play,
      cloud: parts.cloud,
      ...(selfPlayerId
        ? { selfReactions: voterReactions(this.ctx.storage.sql, selfPlayerId) }
        : {}),
      namesReveal: parts.namesReveal,
      stageHidden,
      finishAfterRound: stored.finishAfterRound,
      revealNonce: presentation?.reveal_nonce ?? 0,
      media: parts.media,
      ...this.publicDraft(audience),
      trolls,
      wall: wallSnapshot(this.ctx.storage.sql, audience, selfPlayerId, Date.now()),
      ...(audience === "control"
        ? {
            connections: {
              guests: this.ctx.getWebSockets("guest").length,
              stage: this.ctx.getWebSockets("presentation").length,
              control: this.ctx.getWebSockets("control").length,
            },
            hostEffects: hostTrollRows(this.ctx.storage.sql),
            trollHistory: trollHistoryRows(this.ctx.storage.sql),
            kartCourseHistory:
              play?.question.kind === "kart"
                ? (readKart(this.ctx.storage.sql, play.question.id)?.courseHistory ??
                  [])
                : [],
            adjustments: recentAdjustments(this.ctx.storage.sql),
            adminPlayers: adminPlayerRows(
              this.ctx.storage.sql,
              new Set(
                this.ctx
                  .getWebSockets("guest")
                  .filter((socket) => socket.readyState === WebSocket.OPEN)
                  .map((socket) => this.attachment(socket)?.principalId ?? ""),
              ),
              play,
            ),
          }
        : {}),
      ...(highlights && highlights.length > 0 ? { highlights } : {}),
      ...(recap && recap.length > 0 ? { recap } : {}),
      ...(funFact ? { funFact } : {}),
      ...(funFactList ? { funFactList } : {}),
      ...(audience === "control" ? this.archiveDiagnostic() : {}),
    });
  }

  private archiveDiagnostic(): {
    archive?: {
      status: "pending" | "failed" | "completed";
      revision: number;
      attempts: number;
    };
  } {
    const archive = readRoomArchive(this.ctx.storage.sql);
    if (!archive) {
      return {};
    }
    return {
      archive: {
        status: archive.status,
        revision: archive.targetRevision,
        attempts: archive.attempts,
      },
    };
  }

  /**
   * Every screen needs a new snapshot. Changes in one short window share a
   * single fan-out, so a burst of joins or answers does not rebuild the room
   * once per change. A phase deadline flushes at once.
   */
  private broadcast(urgent = false): void {
    this.markDirty("all", urgent);
  }

  /** Live counts go to the stage and the host. The sending phone already has its snapshot. */
  private broadcastFacilitators(): void {
    this.markDirty("facilitators");
  }

  private markDirty(scope: BroadcastScope, urgent = false): void {
    this.dirty.add(scope);
    if (urgent) {
      this.flushBroadcasts();
      return;
    }
    this.broadcastFlush ??= setTimeout(() => this.flushBroadcasts(), broadcastWindowMs);
  }

  private flushBroadcasts(): void {
    if (this.broadcastFlush !== undefined) {
      clearTimeout(this.broadcastFlush);
      this.broadcastFlush = undefined;
    }
    const scopes = this.dirty;
    this.dirty = new Set();
    if (scopes.size === 0) {
      return;
    }
    const roles: SocketRole[] | undefined = scopes.has("all")
      ? undefined
      : scopes.has("facilitators")
        ? ["presentation", "control"]
        : ["presentation"];
    this.meter.add(
      scopes.has("all")
        ? "broadcast:all"
        : scopes.has("facilitators")
          ? "broadcast:facilitators"
          : "broadcast:stage",
      0,
      Date.now(),
    );
    const shared: SnapshotPartsCache = new Map();
    const sockets = roles
      ? roles.flatMap((role) => this.ctx.getWebSockets(role))
      : this.ctx.getWebSockets();
    for (const socket of sockets) {
      this.sendSnapshot(socket, shared);
    }
  }

  /** Race ticks: the projection is built once, and each phone gets its own short view. */
  private broadcastKart(): boolean {
    const sql = this.ctx.storage.sql;
    const room = createSqlStore(sql).readRoom();
    const question = questionFor(room);
    const hidden =
      sql.exec<{ stage_hidden: number }>(`SELECT stage_hidden FROM room`).toArray()[0]
        ?.stage_hidden === 1;
    if (question?.kind !== "kart" || hidden) {
      return false;
    }
    const frames = kartFrames(sql, question);
    if (!frames) {
      return false;
    }
    const stateVersion = this.readRoom()?.state_version ?? 0;
    const serverNow = Date.now();
    this.meter.add("broadcast:kart", 0, serverNow);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.attachment(socket);
      if (!attachment) {
        continue;
      }
      if (attachment.role !== "guest" && !this.facilitatorAllowed(socket, attachment)) {
        continue;
      }
      this.send(socket, {
        kind: "kart",
        scope: "public",
        stateVersion,
        serverNow,
        submissionCount: frames.submissionCount,
        kart:
          attachment.role === "guest"
            ? frames.forPhone(attachment.principalId)
            : frames.full,
      });
      // The screen merged this frame into its view, so the next patch must resend these.
      const view = this.views.get(socket);
      for (const key of ["play", "serverNow", "stateVersion"]) view?.fields.delete(key);
    }
    return true;
  }

  private broadcastStage(): void {
    this.markDirty("stage");
  }

  private publicDraft(audience: "guest" | "stage" | "control"): {
    draft?: { nickname: string; text: string };
  } {
    if (audience !== "stage") {
      return {};
    }
    const draft = this.stageDraft();
    return draft ? { draft } : {};
  }

  private stageDraft(): { nickname: string; text: string } | null {
    const row = this.ctx.storage.sql
      .exec<{ target_id: string }>(
        `SELECT target_id FROM troll_effect
         WHERE kind = 'typing' AND status = 'active'
         ORDER BY started_at ASC LIMIT 1`,
      )
      .toArray()[0];
    if (!row) {
      return null;
    }
    const draft = this.liveDrafts.get(row.target_id);
    if (!draft?.text) {
      return null;
    }
    const stored = this.ctx.storage.sql
      .exec<{ nickname: string }>(
        `SELECT nickname FROM player WHERE player_id = ?`,
        row.target_id,
      )
      .toArray()[0]?.nickname;
    if (!stored) {
      return null;
    }
    return {
      nickname: displayNickname(this.ctx.storage.sql, row.target_id, stored),
      text: draft.text,
    };
  }

  private noteLiveDraft(playerId: string, text: string): void {
    const active = this.ctx.storage.sql
      .exec(
        `SELECT effect_id FROM troll_effect
         WHERE kind = 'typing' AND status = 'active' AND target_id = ?`,
        playerId,
      )
      .toArray()[0];
    const trimmed = text.trim().slice(0, 80);
    if (!active || !trimmed) {
      if (this.liveDrafts.delete(playerId)) {
        this.broadcastStage();
      }
      return;
    }
    const now = Date.now();
    const previous = this.liveDrafts.get(playerId);
    if (previous && now - previous.shownAt < draftGapMs) {
      this.liveDrafts.set(playerId, { text: trimmed, shownAt: previous.shownAt });
      this.scheduleDraftFlush(draftGapMs - (now - previous.shownAt));
      return;
    }
    this.liveDrafts.set(playerId, { text: trimmed, shownAt: now });
    this.broadcastStage();
  }

  private scheduleDraftFlush(delayMs: number): void {
    if (this.draftFlush !== undefined) {
      return;
    }
    this.draftFlush = setTimeout(() => {
      this.draftFlush = undefined;
      const now = Date.now();
      let due = false;
      for (const draft of this.liveDrafts.values()) {
        if (now - draft.shownAt >= draftGapMs) {
          draft.shownAt = now;
          due = true;
        }
      }
      if (due) {
        this.broadcastStage();
      }
    }, delayMs);
  }

  private sendSnapshot(ws: WebSocket, shared?: SnapshotPartsCache): void {
    const attachment = this.attachment(ws);
    if (!attachment) {
      return;
    }
    if (attachment.role !== "guest" && !this.facilitatorAllowed(ws, attachment)) {
      return;
    }
    const audience =
      attachment.role === "guest"
        ? "guest"
        : attachment.role === "control"
          ? "control"
          : "stage";
    let parts = shared?.get(audience);
    if (!parts) {
      parts = this.snapshotParts(audience);
      shared?.set(audience, parts);
    }
    const snapshot = this.buildSnapshot(
      audience,
      attachment.role === "guest" ? attachment.principalId : undefined,
      parts,
    );
    this.sendView(ws, attachment, snapshot);
  }

  /**
   * Sends the snapshot as a patch against the last view this socket holds when
   * that is clearly smaller, otherwise in full. Views live in memory only: after
   * a restart every screen gets a full snapshot, which is always correct.
   */
  private sendView(
    ws: WebSocket,
    attachment: SocketAttachment,
    snapshot: LobbySnapshot,
  ) {
    const fields = new Map(
      Object.entries(snapshot).map(([key, value]) => [key, JSON.stringify(value)]),
    );
    if (!attachment.patches) {
      this.send(ws, { kind: "snapshot", scope: "public", snapshot });
      return;
    }
    const previous = this.views.get(ws);
    this.viewCount += 1;
    const view = { id: `${this.viewEpoch}.${this.viewCount}`, fields };
    this.views.set(ws, view);
    this.lastViews.set(viewKey(attachment), view);
    if (previous) {
      const set: Record<string, unknown> = {};
      const unset: string[] = [];
      let patchBytes = 0;
      let fullBytes = 0;
      for (const [key, json] of fields) {
        fullBytes += key.length + json.length;
        if (previous.fields.get(key) !== json) {
          set[key] = snapshot[key as keyof LobbySnapshot];
          patchBytes += key.length + json.length;
        }
      }
      for (const key of previous.fields.keys()) {
        if (!fields.has(key)) unset.push(key);
      }
      if (patchBytes < fullBytes * 0.8) {
        this.send(ws, {
          kind: "patch",
          scope: "public",
          base: previous.id,
          view: view.id,
          set,
          unset,
        });
        return;
      }
    }
    this.send(ws, { kind: "snapshot", scope: "public", snapshot, view: view.id });
  }

  /** Stage and control sockets stop receiving room data once their credential lapses. */
  private facilitatorAllowed(ws: WebSocket, attachment: SocketAttachment): boolean {
    const credential = this.ctx.storage.sql
      .exec<{ expires_at: string; revoked_at: string | null }>(
        "SELECT expires_at, revoked_at FROM credential WHERE id = ?",
        attachment.principalId,
      )
      .toArray()[0];
    if (
      credential &&
      !credential.revoked_at &&
      Date.parse(credential.expires_at) > Date.now()
    ) {
      return true;
    }
    const message = "Room access expired or changed. Reopen the room from admin.";
    this.send(ws, { kind: "replaced", scope: "private", message });
    ws.close(4000, message);
    return false;
  }

  private send(
    ws: WebSocket,
    message:
      | { kind: "snapshot"; scope: "public"; snapshot: LobbySnapshot; view?: string }
      | {
          kind: "patch";
          scope: "public";
          base: string;
          view: string;
          set: Record<string, unknown>;
          unset: string[];
        }
      | ({ kind: "kart" } & Omit<KartFrame, "kind">)
      | {
          kind: "ack";
          scope: "private";
          requestId: string;
          accepted: boolean;
          error?: string;
        }
      | { kind: "replaced"; scope: "private"; message: string },
  ): void {
    const attachment = this.attachment(ws);
    if (!attachment) {
      return;
    }
    const next: SocketAttachment = {
      ...attachment,
      deliverySeq: attachment.deliverySeq + 1,
    };
    ws.serializeAttachment(next);
    const payload =
      message.kind === "ack" && message.error
        ? { ...message, deliverySeq: next.deliverySeq }
        : message.kind === "ack"
          ? {
              kind: message.kind,
              scope: message.scope,
              requestId: message.requestId,
              accepted: message.accepted,
              deliverySeq: next.deliverySeq,
            }
          : { ...message, deliverySeq: next.deliverySeq };
    const text = JSON.stringify(payload);
    this.meter.add(`out:${message.kind}`, text.length, Date.now());
    try {
      ws.send(text);
    } catch {
      // The peer already left. The durable record stays.
    }
  }

  private closeOlder(
    current: WebSocket,
    attachment: SocketAttachment,
    message: string,
  ): void {
    for (const socket of this.ctx.getWebSockets(attachment.role)) {
      if (socket === current) {
        continue;
      }
      const older = this.attachment(socket);
      if (!older) {
        continue;
      }
      if (attachment.role === "guest" && older.principalId !== attachment.principalId) {
        continue;
      }
      this.send(socket, { kind: "replaced", scope: "private", message });
      socket.close(4000, message);
    }
  }

  private closePlayerSockets(playerId: string, message: string): void {
    for (const socket of this.ctx.getWebSockets("guest")) {
      const attachment = this.attachment(socket);
      if (!attachment || attachment.principalId !== playerId) {
        continue;
      }
      this.send(socket, { kind: "replaced", scope: "private", message });
      socket.close(4000, message);
    }
  }

  private attachment(ws: WebSocket): SocketAttachment | null {
    const value: unknown = ws.deserializeAttachment();
    if (!value || typeof value !== "object") {
      return null;
    }
    const record = value as Partial<SocketAttachment>;
    if (
      (record.role !== "guest" &&
        record.role !== "control" &&
        record.role !== "presentation") ||
      typeof record.principalId !== "string" ||
      typeof record.deliverySeq !== "number"
    ) {
      return null;
    }
    return {
      role: record.role,
      principalId: record.principalId,
      deliverySeq: record.deliverySeq,
      ...(record.patches === true ? { patches: true } : {}),
    };
  }

  private readReceipt(
    principal: string,
    requestId: string,
  ): { digest: string; resultJson: string } | null {
    const row = this.ctx.storage.sql
      .exec<{ payload_digest: string; result_json: string }>(
        `SELECT payload_digest, result_json FROM receipt WHERE principal = ? AND request_id = ?`,
        principal,
        requestId,
      )
      .toArray()[0];
    return row ? { digest: row.payload_digest, resultJson: row.result_json } : null;
  }

  private writeReceipt(
    principal: string,
    requestId: string,
    digest: string,
    result: unknown,
  ): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO receipt (principal, request_id, payload_digest, result_json)
       VALUES (?, ?, ?, ?)`,
      principal,
      requestId,
      digest,
      JSON.stringify(result),
    );
  }

  private readCount(scope: string, name: string): number {
    const row = this.ctx.storage.sql
      .exec<{ value: number }>(
        `SELECT value FROM counter WHERE scope = ? AND name = ?`,
        scope,
        name,
      )
      .toArray()[0];
    return row?.value ?? 0;
  }

  private writeCount(scope: string, name: string): number {
    const next = this.readCount(scope, name) + 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO counter (scope, name, value) VALUES (?, ?, ?)
       ON CONFLICT (scope, name) DO UPDATE SET value = excluded.value`,
      scope,
      name,
      next,
    );
    return next;
  }

  /** In-memory rate limit. A rejected sender costs no storage write. */
  private allow(key: string, limit: RateLimit): boolean {
    const now = Date.now();
    const result = takeToken(this.rateBuckets.get(key), limit, now);
    this.rateBuckets.set(key, result.bucket);
    if (this.rateBuckets.size > maxRateBuckets) {
      for (const [stale, bucket] of this.rateBuckets) {
        if (now - bucket.at > 60_000) this.rateBuckets.delete(stale);
      }
    }
    return result.allowed;
  }

  private writeAudit(
    kind: string,
    principal: string,
    createdAt: string,
    detail: unknown,
  ): void {
    const json = JSON.stringify(detail);
    this.ctx.storage.sql.exec(
      `INSERT INTO audit (kind, principal, created_at, detail) VALUES (?, ?, ?, ?)`,
      kind,
      principal,
      createdAt,
      json,
    );
  }
}

function choiceMessage(
  reason: "phase" | "paused" | "held" | "late" | "duplicate" | "option",
): string {
  if (reason === "option") {
    return answerUnknownMessage;
  }
  return answerMessage(reason);
}

function answerMessage(
  reason: "phase" | "paused" | "held" | "late" | "duplicate",
): string {
  if (reason === "late") {
    return answerLateMessage;
  }
  if (reason === "paused") {
    return answerPausedMessage;
  }
  if (reason === "held") {
    return answerHeldMessage;
  }
  if (reason === "duplicate") {
    return answerDuplicateMessage;
  }
  return answerClosedMessage;
}

function publicSecret(
  input: CredentialSecrets & { secretHash: string },
): CredentialSecrets {
  return {
    credentialId: input.credentialId,
    secret: input.secret,
    expiresAt: input.expiresAt,
  };
}

function validRequestId(value: string): boolean {
  return /^[0-9a-f-]{8,80}$/i.test(value);
}

function denied(
  status: Failure["status"],
  error: Failure["error"],
  message: string,
): Failure {
  return { ok: false, status, error, message };
}

function acceptRoundCommand(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  command:
    | { name: "estimate"; value: unknown }
    | { name: "rank"; placements: unknown }
    | { name: "text"; body: unknown }
    | { name: "ballot"; candidateId: unknown; epoch?: unknown }
    | { name: "duel"; value: unknown }
    | { name: "troll"; kind: unknown; targetId: unknown; mediaId?: string }
    | { name: "troll-escape"; effectId: unknown }
    | WallCommand,
  now: number,
  question: Question | undefined,
): { ok: true } | { ok: false; message: string } {
  if (command.name === "estimate") {
    if (!question || question.kind !== "slider") {
      return { ok: false, message: wrongKindEstimate() };
    }
    return acceptEstimate(sql, store, playerId, command.value, now, question);
  }
  if (command.name === "rank") {
    if (!question || question.kind !== "rank") {
      return { ok: false, message: wrongKindRank() };
    }
    return acceptRanking(sql, store, playerId, command.placements, now, question);
  }
  if (command.name === "text") {
    if (question?.kind === "choice" && question.outcome.kind === "multiple")
      return acceptMultiple(sql, store, playerId, command.body, now, question);
    if (question?.kind === "wordle") {
      return acceptWordleGuess(sql, store, playerId, command.body, now, question);
    }
    if (question?.kind === "typed") {
      return acceptTypedAnswer(sql, store, playerId, command.body, now, question);
    }
    if (!question || question.kind !== "vote") {
      return { ok: false, message: wrongKindText() };
    }
    return acceptText(sql, store, playerId, command.body, now, question);
  }
  if (command.name === "troll") {
    return acceptTroll(
      sql,
      store,
      playerId,
      command.kind,
      command.targetId,
      now,
      command.mediaId,
    );
  }
  if (command.name === "troll-escape") {
    return escapeTroll(sql, store, playerId, command.effectId, now);
  }
  if (command.name === "wall-react") {
    return reactToWall(sql, playerId, command, now);
  }
  if (command.name === "wall-post" || command.name === "wall-withdraw") {
    const result =
      command.name === "wall-post"
        ? createWallPost(sql, playerId, command, now)
        : withdrawWallPost(sql, playerId, command.postId);
    if (result.ok) {
      syncWall(sql, "tick", now);
    }
    return result;
  }
  if (command.name === "duel") {
    if (!question || (question.kind !== "duel" && question.kind !== "finale")) {
      return { ok: false, message: wrongKindDuel() };
    }
    return acceptDuel(sql, store, playerId, command.value, now, question);
  }
  if (question?.kind === "finale") {
    return acceptPrediction(sql, store, playerId, command.candidateId, now, question);
  }
  if (!question || (question.kind !== "vote" && question.kind !== "guess")) {
    return { ok: false, message: wrongKindBallot() };
  }
  return acceptBallot(
    sql,
    store,
    playerId,
    command.candidateId,
    now,
    question,
    command.epoch,
  );
}

function readCommand(body: unknown):
  | { requestId: string; name: "kart-recover" | "kart-use-item"; raceId: string }
  | { requestId: string; name: "kart-input"; input: unknown }
  | { requestId: string; name: "snapshot" }
  | { requestId: string; name: "answer"; optionId: string }
  | { requestId: string; name: "estimate"; value: unknown }
  | { requestId: string; name: "rank"; placements: unknown }
  | { requestId: string; name: "text"; body: unknown }
  | { requestId: string; name: "ballot"; candidateId: unknown; epoch?: unknown }
  | { requestId: string; name: "duel"; value: unknown }
  | { requestId: string; name: "draft"; text: string }
  | {
      requestId: string;
      name: "troll";
      kind: unknown;
      targetId: unknown;
      mediaId?: string;
    }
  | { requestId: string; name: "troll-escape"; effectId: unknown }
  | {
      requestId: string;
      name: "wall-post";
      mediaId: unknown;
      caption: unknown;
      frame: unknown;
      keep: unknown;
    }
  | { requestId: string; name: "wall-withdraw"; postId: unknown }
  | { requestId: string; name: "wall-react"; postId: unknown; reaction: unknown }
  | { requestId: string; name: "react"; targetId: string; reaction: "like" | "dislike" }
  | { requestId: string; name: "driver"; style: unknown; faceMediaId: unknown }
  | { requestId: string; name: "device"; reason: string; report: unknown }
  | {
      requestId: string;
      name: "connection";
      rttMs: unknown;
      submissionRetries: unknown;
      uploadAttempts: unknown;
      uploadFailures: unknown;
      uploadDurationMs: unknown;
      scriptErrors?: unknown;
      lastScriptError?: unknown;
    }
  | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (record.kind !== "command") {
    return null;
  }
  if (record.name === "draft" && typeof record.text === "string") {
    return { requestId: "draft-live", name: "draft", text: record.text };
  }
  if (typeof record.requestId !== "string" || !validRequestId(record.requestId)) {
    return null;
  }
  if (record.name === "kart-input")
    return { requestId: record.requestId, name: "kart-input", input: record.input };
  if (
    (record.name === "kart-recover" || record.name === "kart-use-item") &&
    typeof record.raceId === "string" &&
    record.raceId.length > 0 &&
    record.raceId.length <= 120
  )
    return { requestId: record.requestId, name: record.name, raceId: record.raceId };
  if (record.name === "snapshot") {
    return { requestId: record.requestId, name: "snapshot" };
  }
  if (
    record.name === "answer" &&
    typeof record.optionId === "string" &&
    /^[a-z0-9-]{1,16}$/.test(record.optionId)
  ) {
    return { requestId: record.requestId, name: "answer", optionId: record.optionId };
  }
  if (record.name === "estimate") {
    return { requestId: record.requestId, name: "estimate", value: record.value };
  }
  if (record.name === "rank") {
    return { requestId: record.requestId, name: "rank", placements: record.placements };
  }
  if (record.name === "text") {
    return { requestId: record.requestId, name: "text", body: record.body };
  }
  if (record.name === "ballot") {
    return {
      requestId: record.requestId,
      name: "ballot",
      candidateId: record.candidateId,
      ...(record.epoch === undefined ? {} : { epoch: record.epoch }),
    };
  }
  if (record.name === "duel") {
    return { requestId: record.requestId, name: "duel", value: record.value };
  }
  if (record.name === "wall-post") {
    return {
      requestId: record.requestId,
      name: "wall-post",
      mediaId: record.mediaId,
      caption: record.caption,
      frame: record.frame,
      keep: record.keep,
    };
  }
  if (record.name === "wall-withdraw") {
    return {
      requestId: record.requestId,
      name: "wall-withdraw",
      postId: record.postId,
    };
  }
  if (record.name === "wall-react") {
    return {
      requestId: record.requestId,
      name: "wall-react",
      postId: record.postId,
      reaction: record.reaction,
    };
  }
  if (record.name === "troll") {
    const mediaId =
      typeof record.mediaId === "string" && /^[0-9a-f-]{36}$/i.test(record.mediaId)
        ? record.mediaId
        : undefined;
    return {
      requestId: record.requestId,
      name: "troll",
      kind: record.effect,
      targetId: record.targetId,
      ...(mediaId ? { mediaId } : {}),
    };
  }
  if (record.name === "troll-escape") {
    return {
      requestId: record.requestId,
      name: "troll-escape",
      effectId: record.effectId,
    };
  }
  if (record.name === "device") {
    const reason =
      record.reason === "initial" ||
      record.reason === "phase" ||
      record.reason === "interval"
        ? record.reason
        : "interval";
    return {
      requestId: record.requestId,
      name: "device",
      reason,
      report: record.report,
    };
  }
  if (record.name === "connection") {
    return {
      requestId: record.requestId,
      name: "connection",
      rttMs: record.rttMs,
      submissionRetries: record.submissionRetries,
      uploadAttempts: record.uploadAttempts,
      uploadFailures: record.uploadFailures,
      uploadDurationMs: record.uploadDurationMs,
      scriptErrors: record.scriptErrors,
      lastScriptError: record.lastScriptError,
    };
  }
  if (
    record.name === "react" &&
    typeof record.targetId === "string" &&
    /^[0-9a-f-]{36}$/i.test(record.targetId) &&
    (record.reaction === "like" || record.reaction === "dislike")
  ) {
    return {
      requestId: record.requestId,
      name: "react",
      targetId: record.targetId,
      reaction: record.reaction,
    };
  }
  if (record.name === "driver") {
    return {
      requestId: record.requestId,
      name: "driver",
      style: record.style,
      faceMediaId: record.faceMediaId,
    };
  }
  return null;
}

function roomResponse(status: number, error: string, message: string): Response {
  return Response.json(
    { error, message },
    { status, headers: { "cache-control": "no-store" } },
  );
}
