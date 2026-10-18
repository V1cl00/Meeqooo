-- Ausblenden mit Reichweite: alles von einer Person oder eine ganze Kategorie (einzelne Treffen bleiben in hidden_activities).
create table if not exists hidden_rules (
  user_id text not null,
  kind text not null, -- 'user' | 'category'
  value text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, kind, value)
);
