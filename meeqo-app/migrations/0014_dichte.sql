-- Sparte als eigene Spalte statt Textmuster in der Kategorie.
alter table activities add column if not exists area text not null default 'meetup';
update activities set area = 'business' where area = 'meetup' and (category = 'Business' or category like 'Business · %');
update activities set area = 'event' where area = 'meetup' and host_id in (select user_id from profiles where is_organizer);

-- Kleinanzeigen: Interesse melden fuehrt in einen Chat zwischen Anbieter und Interessent.
create table if not exists classified_threads (
  id text primary key,
  classified_id text not null,
  buyer_id text not null,
  seller_id text not null,
  created_at timestamptz not null default now(),
  unique (classified_id, buyer_id)
);

create table if not exists classified_messages (
  id text primary key,
  thread_id text not null,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists classified_threads_buyer_idx on classified_threads (buyer_id);
create index if not exists classified_threads_seller_idx on classified_threads (seller_id);
create index if not exists classified_messages_thread_idx on classified_messages (thread_id, created_at);

-- Tempo: was jemand von dem Treffen erwartet, steht an der Anfrage.
alter table join_requests add column if not exists mood text not null default '';

-- Lust auf ein Treffen, das es noch nicht gibt. Ab drei Leuten pro Kategorie und Stadt gibt es einen Hinweis.
create table if not exists wishes (
  id text primary key,
  user_id text not null,
  category text not null,
  city text not null,
  day text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, category, city)
);

-- Vertrauensperson: ein Link, der Zeit, Ort und Check-in-Status zeigt.
create table if not exists safety_shares (
  token text primary key,
  user_id text not null,
  activity_id text not null,
  contact text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists safety_shares_user_idx on safety_shares (user_id, activity_id);
