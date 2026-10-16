alter table profiles add column if not exists avatar_url text not null default '';

create table if not exists favorites (
  user_id text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);
