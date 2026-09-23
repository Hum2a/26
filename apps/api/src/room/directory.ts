import type {
  RoomCredentialRecord,
  RoomCredentialDirectory,
} from "../credentials/types.ts";

type CredentialRow = {
  id: string;
  principal: string;
  player_id: string | null;
  secret_hash: string;
  expires_at: string;
  revoked_at: string | null;
};

export function insertCredential(
  sql: SqlStorage,
  input: {
    id: string;
    principal: string;
    playerId: string | null;
    secretHash: string;
    expiresAt: string;
  },
): void {
  sql.exec(
    `INSERT INTO credential (id, principal, player_id, secret_hash, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.principal,
    input.playerId,
    input.secretHash,
    input.expiresAt,
  );
}

export function createSqliteRoomCredentialDirectory(
  sql: SqlStorage,
): RoomCredentialDirectory {
  return {
    async save(record: RoomCredentialRecord) {
      insertCredential(sql, {
        id: record.id,
        principal: record.role,
        playerId: null,
        secretHash: record.secretHash,
        expiresAt: record.expiresAt,
      });
    },
    async get(credentialId: string) {
      const row = sql
        .exec<CredentialRow>(
          `SELECT id, principal, player_id, secret_hash, expires_at, revoked_at
           FROM credential WHERE id = ?`,
          credentialId,
        )
        .toArray()[0];
      if (!row || (row.principal !== "control" && row.principal !== "presentation")) {
        return null;
      }
      const room = sql
        .exec<{ game_id: string }>("SELECT game_id FROM room")
        .toArray()[0];
      if (!room) {
        return null;
      }
      return {
        id: row.id,
        roomId: room.game_id,
        role: row.principal,
        secretHash: row.secret_hash,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
      };
    },
    async revoke(credentialId: string, revokedAt: string) {
      sql.exec(
        `UPDATE credential SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
        revokedAt,
        credentialId,
      );
    },
  };
}
