-- 18+: ohne Bestaetigung keine Anfragen, keine Treffen, keine Anzeigen.
alter table profiles add column if not exists age_confirmed_at timestamptz;
update profiles set age_confirmed_at = now() where user_id like 'seed:%' and age_confirmed_at is null;

-- Beispiel-Profile sind nicht geprueft und tragen kein Bestaetigt-Abzeichen.
update profiles set identity_confirmed = false where user_id like 'seed:%';

-- Mails zu Zusagen und Anfragen, nur wenn ein Mail-Dienst eingerichtet ist.
alter table profiles add column if not exists notify_email boolean not null default true;

-- Begrenzung: wie oft jemand etwas in einem Zeitfenster tun darf.
create table if not exists rate_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_events_idx on rate_events (user_id, kind, created_at desc);

-- Fehler aus dem Browser, ohne Dienst von aussen.
create table if not exists error_log (
  id bigint generated always as identity primary key,
  user_id text,
  path text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists error_log_idx on error_log (created_at desc);

-- Indizes fuer das, was jede Seite fragt.
create index if not exists activities_starts_idx on activities (starts_at);
create index if not exists activities_host_idx on activities (host_id);
create index if not exists join_requests_activity_idx on join_requests (activity_id, status);
create index if not exists ratings_ratee_idx on ratings (ratee_id);
