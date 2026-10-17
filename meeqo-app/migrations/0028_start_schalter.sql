-- Schalter fuer Bereiche (Admin stellt sie um, ohne neue Version) und aktive Tage fuer Wiederkehr-Zahlen.
create table if not exists app_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);
-- Start in Karlsruhe: Freunde und Aktivitaeten. Dating, Business und Kleinanzeigen sind zu, bis sie freigeschaltet werden.
insert into app_flags (key, enabled) values
  ('dating', false), ('business', false), ('classifieds', false), ('communities', true)
on conflict (key) do nothing;

-- Pro Konto und Tag eine Zeile, mehr nicht. Wird mit dem Konto geloescht.
create table if not exists activity_days (
  user_id text not null,
  day date not null,
  primary key (user_id, day)
);
create index if not exists activity_days_day_idx on activity_days (day);
