import { DurableObject } from "cloudflare:workers";
import { lobbyCreatedSchema, type LobbyCreated } from "@26/shared";
import { randomToken } from "./codes.ts";
import { digestMismatchMessage } from "./limits.ts";
import { ensureRegistrySchema } from "./schema.ts";

type CreateResult = LobbyCreated & {
  control: { credentialId: string; secret: string; expiresAt: string };
  presentation: { credentialId: string; secret: string; expiresAt: string };
};

type StoredCreate =
  | { pending: true; gameId: string; joinCode: string }
  | ({ pending: false } & CreateResult);

/**
 * One SQLite object, addressed only as getByName("codes").
 * A join code maps to a game id after this isolate has slept.
 */
export class RoomCodeRegistry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ensureRegistrySchema(ctx.storage.sql);
    });
  }

  async claim(input: {
    joinCode: string;
    gameId: string;
    createdAt: string;
  }): Promise<{ ok: true } | { ok: false; reason: "code" | "id" }> {
    return this.claimSync(input.joinCode, input.gameId, input.createdAt);
  }

  async hasGame(gameId: string): Promise<boolean> {
    const row = this.ctx.storage.sql
      .exec<{ game_id: string }>(
        `SELECT game_id FROM code WHERE game_id = ?`,
        gameId.toUpperCase(),
      )
      .toArray()[0];
    return Boolean(row);
  }

  async resolve(joinCode: string): Promise<{ gameId: string } | null> {
    const row = this.ctx.storage.sql
      .exec<{ game_id: string }>(
        "SELECT game_id FROM code WHERE join_code = ?",
        joinCode.toUpperCase(),
      )
      .toArray()[0];
    return row ? { gameId: row.game_id } : null;
  }

  async createLobby(input: {
    requestId: string;
    digest: string;
    now: string;
  }): Promise<
    | { ok: true; result: CreateResult }
    | { ok: false; error: "digest_mismatch" | "busy"; message: string }
  > {
    const prior = this.readCreate(input.requestId);
    if (prior) {
      if (prior.digest !== input.digest) {
        return { ok: false, error: "digest_mismatch", message: digestMismatchMessage };
      }
      if (prior.stored.pending) {
        return this.finish(input.requestId, prior.stored, input.now);
      }
      return { ok: true, result: this.withoutPending(prior.stored) };
    }

    const allocated = this.allocate(input.now);
    const pending: StoredCreate = {
      pending: true,
      gameId: allocated.gameId,
      joinCode: allocated.joinCode,
    };
    this.ctx.storage.sql.exec(
      `INSERT INTO receipt (principal, request_id, payload_digest, result_json)
       VALUES ('admin', ?, ?, ?)`,
      input.requestId,
      input.digest,
      JSON.stringify(pending),
    );
    return this.finish(input.requestId, pending, input.now);
  }

  private allocate(now: string): { gameId: string; joinCode: string } {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const gameId = randomToken(12);
      const joinCode = randomToken(6);
      const claimed = this.claimSync(joinCode, gameId, now);
      if (claimed.ok) {
        return { gameId, joinCode };
      }
    }
    throw new Error("Could not allocate a room code.");
  }

  private claimSync(
    joinCode: string,
    gameId: string,
    createdAt: string,
  ): { ok: true } | { ok: false; reason: "code" | "id" } {
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO code (join_code, game_id, created_at) VALUES (?, ?, ?)`,
        joinCode.toUpperCase(),
        gameId.toUpperCase(),
        createdAt,
      );
      return { ok: true };
    } catch (error) {
      const message = String(error);
      if (!message.includes("UNIQUE")) {
        throw error;
      }
      if (message.includes("game_id")) {
        return { ok: false, reason: "id" };
      }
      return { ok: false, reason: "code" };
    }
  }

  private async finish(
    requestId: string,
    pending: Extract<StoredCreate, { pending: true }>,
    now: string,
  ): Promise<
    { ok: true; result: CreateResult } | { ok: false; error: "busy"; message: string }
  > {
    const roomId = this.env.PARTY_ROOM.idFromName(pending.gameId);
    const created = await this.env.PARTY_ROOM.get(roomId).ensureLobby({
      gameId: pending.gameId,
      joinCode: pending.joinCode,
      now,
    });
    const result: CreateResult = {
      ...lobbyCreatedSchema.parse({
        gameId: created.gameId,
        joinCode: created.joinCode,
        phase: created.phase,
        questionSetVersion: created.questionSetVersion,
        scoringVersion: created.scoringVersion,
        playerCount: created.playerCount,
      }),
      control: created.control,
      presentation: created.presentation,
    };
    this.ctx.storage.sql.exec(
      `UPDATE receipt SET result_json = ? WHERE principal = 'admin' AND request_id = ?`,
      JSON.stringify({ pending: false, ...result }),
      requestId,
    );
    return { ok: true, result };
  }

  private readCreate(
    requestId: string,
  ): { digest: string; stored: StoredCreate } | null {
    const row = this.ctx.storage.sql
      .exec<{ payload_digest: string; result_json: string }>(
        `SELECT payload_digest, result_json FROM receipt
         WHERE principal = 'admin' AND request_id = ?`,
        requestId,
      )
      .toArray()[0];
    if (!row) {
      return null;
    }
    return {
      digest: row.payload_digest,
      stored: JSON.parse(row.result_json) as StoredCreate,
    };
  }

  private withoutPending(
    stored: Extract<StoredCreate, { pending: false }>,
  ): CreateResult {
    return {
      gameId: stored.gameId,
      joinCode: stored.joinCode,
      phase: stored.phase,
      questionSetVersion: stored.questionSetVersion,
      scoringVersion: stored.scoringVersion,
      playerCount: stored.playerCount,
      control: stored.control,
      presentation: stored.presentation,
    };
  }
}
