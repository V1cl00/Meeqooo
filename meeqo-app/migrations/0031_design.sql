-- Runde Design: spontanes Zeitsignal (nur für Freunde), Ideenwand, private Freundes-Threads, Dank nach dem Treffen, Seitenfarbe.

-- "Ich hab jetzt 2 Std Zeit": freiwillig, sehen nur bestätigte Freunde, läuft von selbst ab. Kein Standort, nur die Stadt.
create table if not exists free_signals (
  user_id text primary key,
  until timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Ideenwand: eine Idee pro Zeile, "Ich auch" pro Person einmal. Wird daraus ein Treffen, bekommen alle Ich-auchs eine Mitteilung.
create table if not exists ideas (
  id text primary key,
  user_id text not null,
  text text not null,
  city text not null default '',
  activity_id text,
  created_at timestamptz not null default now()
);
create table if not exists idea_votes (
  idea_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
create index if not exists ideas_city_idx on ideas (city, created_at);

-- Private Nachrichten zwischen zwei bestätigten Freunden. pair = kleinere id + ':' + größere id.
create table if not exists friend_messages (
  id text primary key,
  pair text not null,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_messages_pair_idx on friend_messages (pair, created_at);

-- Danke nach dem Treffen: einmal pro Treffen und Person, nur privat.
create table if not exists thanks (
  activity_id text not null,
  from_id text not null,
  to_id text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, from_id, to_id)
);

-- Eigene Seitenfarbe für das Profil (nur aus der Markenpalette).
alter table profiles add column if not exists page_style text not null default '';
