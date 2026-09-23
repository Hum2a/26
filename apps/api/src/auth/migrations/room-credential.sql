create table if not exists room_credential (
  id text primary key,
  room_id text not null,
  role text not null,
  secret_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
