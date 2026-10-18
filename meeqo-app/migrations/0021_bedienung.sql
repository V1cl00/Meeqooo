-- Alles gut zuhause angekommen: wann jemand nach dem Treffen Bescheid gesagt hat.
alter table checkins add column if not exists safe_at timestamptz;

-- Wie lange ein Treffen dauert (Standard zwei Stunden), fuer Kalender und "Als Naechstes".
alter table activities add column if not exists duration_min integer not null default 120;

-- Terminabstimmung im Chat: Optionen als JSON-Liste von Zeitpunkten, eine Stimme pro Person.
create table if not exists polls (
  id text primary key,
  activity_id text not null,
  creator_id text not null,
  question text not null,
  options text not null default '[]',
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists polls_activity_idx on polls (activity_id, created_at);

create table if not exists poll_votes (
  poll_id text not null,
  user_id text not null,
  option_idx integer not null,
  primary key (poll_id, user_id)
);

-- Mitfahren zu einem Treffen.
create table if not exists rides (
  id text primary key,
  activity_id text not null,
  driver_id text not null,
  seats integer not null,
  origin text not null default '',
  created_at timestamptz not null default now(),
  unique (activity_id, driver_id)
);

create table if not exists ride_riders (
  ride_id text not null,
  rider_id text not null,
  primary key (ride_id, rider_id)
);

-- Geheimer Link, mit dem Kalender-Apps die eigenen Treffen abonnieren.
create table if not exists calendar_tokens (
  user_id text primary key,
  token text not null unique,
  created_at timestamptz not null default now()
);
