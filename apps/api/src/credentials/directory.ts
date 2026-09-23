import type { AppDatabase } from "../auth/create-database.ts";
import type { RoomCredentialDirectory, RoomCredentialRecord } from "./types.ts";
import type { RoomCredentialRole } from "@26/shared";

export function createSqlRoomCredentialDirectory(
  database: AppDatabase,
): RoomCredentialDirectory {
  return {
    async save(record) {
      await database.executor.query(
        `insert into room_credential (id, room_id, role, secret_hash, expires_at, revoked_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          record.id,
          record.roomId,
          record.role,
          record.secretHash,
          record.expiresAt,
          record.revokedAt,
        ],
      );
    },
    async get(credentialId) {
      const rows = await database.executor.query(
        `select id, room_id, role, secret_hash, expires_at, revoked_at
         from room_credential
         where id = $1`,
        [credentialId],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      return mapRecord(row);
    },
    async revoke(credentialId, revokedAt) {
      await database.executor.query(
        `update room_credential
         set revoked_at = $2
         where id = $1 and revoked_at is null`,
        [credentialId, revokedAt],
      );
    },
  };
}

function mapRecord(row: Record<string, unknown>): RoomCredentialRecord {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    role: String(row.role) as RoomCredentialRole,
    secretHash: String(row.secret_hash),
    expiresAt: instant(row.expires_at),
    revokedAt: row.revoked_at == null ? null : instant(row.revoked_at),
  };
}

function instant(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }
  throw new Error("Unexpected timestamp from the credential directory.");
}
