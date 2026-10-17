-- Melden und Blockieren.
create table if not exists reports (
  id text primary key,
  reporter_id text not null,
  kind text not null,
  target_id text not null,
  reason text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on reports (kind, target_id);

create table if not exists blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists blocks_blocked_idx on blocks (blocked_id);

-- Einladung: ein Link fuer Leute ohne Konto, der ein bestehendes Treffen zeigt.
create table if not exists invites (
  token text primary key,
  activity_id text not null,
  inviter_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists invites_activity_idx on invites (activity_id, inviter_id);

-- Web-Push: ein Eintrag pro Browser, der Mitteilungen bekommen will.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
