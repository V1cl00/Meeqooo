-- Passwort zuruecksetzen: nur der Hash des Links wird gespeichert, der Link gilt eine Stunde.
create table if not exists password_resets (
  token_hash text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_user_idx on password_resets (user_id);
