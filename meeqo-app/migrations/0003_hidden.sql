create table if not exists hidden_activities (
  user_id text not null,
  activity_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index if not exists hidden_activities_user_idx on hidden_activities (user_id);
