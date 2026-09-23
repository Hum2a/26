import type { RoomCredentialRole } from "@26/shared";

/**
 * Stored verifier for one room credential.
 * Prompt 03 keeps this record with the room and calls verifyRoomCredential.
 * Live commands must not load it from Neon on each action.
 */
export type RoomCredentialRecord = {
  id: string;
  roomId: string;
  role: RoomCredentialRole;
  secretHash: string;
  expiresAt: string;
  revokedAt: string | null;
};

export interface RoomCredentialDirectory {
  save(record: RoomCredentialRecord): Promise<void>;
  get(credentialId: string): Promise<RoomCredentialRecord | null>;
  revoke(credentialId: string, revokedAt: string): Promise<void>;
}
