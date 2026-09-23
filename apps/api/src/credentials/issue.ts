import type { RoomCredentialRole } from "@26/shared";
import type { RoomCredentialDirectory, RoomCredentialRecord } from "./types.ts";
import {
  createCredentialSecret,
  credentialLifetimeMs,
  hashCredentialSecret,
} from "./verify.ts";

export async function issueRoomCredential(input: {
  directory: RoomCredentialDirectory;
  roomId: string;
  role: RoomCredentialRole;
  now: Date;
}): Promise<{ record: RoomCredentialRecord; secret: string }> {
  const secret = createCredentialSecret();
  const record: RoomCredentialRecord = {
    id: crypto.randomUUID(),
    roomId: input.roomId,
    role: input.role,
    secretHash: await hashCredentialSecret(secret),
    expiresAt: new Date(
      input.now.getTime() + credentialLifetimeMs(input.role),
    ).toISOString(),
    revokedAt: null,
  };
  await input.directory.save(record);
  return { record, secret };
}
