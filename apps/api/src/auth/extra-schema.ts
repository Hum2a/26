/**
 * These statements are ours. They are not Better Auth tables.
 * Better Auth tables come from getMigrations.
 */

export const roomCredentialSql = `create table if not exists room_credential (
  id text primary key,
  room_id text not null,
  role text not null,
  secret_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
`;

/** Local development only. Staging and production do not create this table. */
export const devInboxSql = `create table if not exists dev_inbox (
  id text primary key,
  recipient text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null
);
`;
