-- Mitteilungs-Schluessel der Android- und iOS-Apps (Firebase Cloud Messaging; iOS laeuft ueber denselben Weg).
create table if not exists native_push (
  token text primary key,
  user_id text not null,
  platform text not null,
  updated_at timestamptz not null default now()
);
create index if not exists native_push_user_idx on native_push (user_id);
