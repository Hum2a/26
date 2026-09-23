create table if not exists dev_inbox (
  id text primary key,
  recipient text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null
);
