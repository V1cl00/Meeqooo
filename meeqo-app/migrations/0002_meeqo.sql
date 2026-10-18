create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  bio text not null default '',
  intent text not null default '',
  open_to text not null default '',
  seeking text not null default '[]',
  city text not null default '',
  lat double precision,
  lng double precision,
  radius_km integer not null default 25,
  is_organizer boolean not null default false,
  organizer_name text not null default '',
  booking_mode text not null default 'request',
  identity_confirmed boolean not null default false,
  trusted_label text not null default '',
  onboarding_done boolean not null default false,
  notify_push boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists communities (
  id text primary key,
  owner_id text not null,
  name text not null,
  topic text not null,
  city text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists community_members (
  community_id text not null,
  user_id text not null,
  primary key (community_id, user_id)
);

create table if not exists activities (
  id text primary key,
  host_id text not null,
  title text not null,
  description text not null default '',
  category text not null,
  intent text not null,
  place_name text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  spots integer not null default 4,
  image_url text not null default '',
  booking_mode text not null default 'request',
  community_id text,
  public_place boolean not null default true,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists join_requests (
  id text primary key,
  activity_id text not null,
  requester_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (activity_id, requester_id)
);

create table if not exists messages (
  id text primary key,
  activity_id text not null,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists ratings (
  id text primary key,
  activity_id text not null,
  rater_id text not null,
  ratee_id text not null,
  punctual integer not null,
  respectful integer not null,
  matches_profile integer not null,
  want_again boolean not null default false,
  created_at timestamptz not null default now(),
  unique (activity_id, rater_id, ratee_id)
);

create table if not exists checkins (
  activity_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '/',
  ref_id text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists custom_categories (
  id text primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists activities_starts_idx on activities (starts_at);
create index if not exists join_requests_requester_idx on join_requests (requester_id);
create index if not exists messages_activity_idx on messages (activity_id, created_at);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

insert into profiles (user_id, display_name, bio, intent, open_to, seeking, city, lat, lng, radius_km, is_organizer, organizer_name, booking_mode, identity_confirmed, onboarding_done)
values
  ('seed:mira', 'Mira Kessler', 'Trainiert draußen, redet lieber nach dem Satz als davor.', 'friends', 'friends', '["Sport","Outdoor"]', 'Karlsruhe', 49.0128, 8.3995, 25, false, '', 'request', true, true),
  ('seed:jonas', 'Jonas Albrecht', 'Mag klare Verabredungen und Orte, an denen man wieder gehen kann.', 'curious', 'dating', '["Essen","Kultur"]', 'Karlsruhe', 49.0092, 8.4039, 25, false, '', 'request', true, true),
  ('seed:nora', 'Nora Vogt', 'Spaziergänge, bei denen niemand performen muss.', 'serious', 'dating', '["Outdoor","Kultur"]', 'Karlsruhe', 49.0136, 8.4044, 20, false, '', 'request', true, true),
  ('seed:amir', 'Amir Haddad', 'Klettert seit Jahren, nimmt Anfänger mit, ohne es zu einem Kurs zu machen.', 'friends', 'friends', '["Sport"]', 'Karlsruhe', 49.0025, 8.352, 30, false, '', 'request', true, true),
  ('seed:leonie', 'Leonie Kranz', 'Brettspiele, Tee, kein Kompetitionsdruck.', 'friends', 'friends', '["Spiele"]', 'Heidelberg', 49.4124, 8.7103, 20, false, '', 'request', true, true),
  ('seed:rheinrad', 'Rheinrad', 'Geführte Feierabendtouren am Rhein. Helme leihen wir aus.', 'friends', 'both', '["Outdoor","Sport"]', 'Mannheim', 49.4915, 8.456, 40, true, 'Rheinrad', 'instant', true, true),
  ('seed:tischlein', 'Tischlein', 'Kleine Kochabende in der Küche an der Kaiserstraße.', 'curious', 'both', '["Essen"]', 'Karlsruhe', 49.0096, 8.385, 25, true, 'Tischlein', 'instant', true, true),
  ('seed:therme', 'Therme Mannheim', 'Ruhige Bahnen, kein Animationsprogramm.', 'friends', 'friends', '["Wellness"]', 'Mannheim', 49.479, 8.475, 30, true, 'Therme Mannheim', 'instant', true, true)
on conflict (user_id) do nothing;

insert into communities (id, owner_id, name, topic, city, description) values
  ('com-joggen', 'seed:mira', 'Joggen Karlsruhe', 'Outdoor', 'Karlsruhe', 'Lockere Laufrunden, Tempo nach Gefühl. Neue Leute laufen vorn mit, niemand wird abgehängt.'),
  ('com-cali', 'seed:mira', 'Calisthenics Karlsruhe', 'Sport', 'Karlsruhe', 'Barren und Ringe im Stadtgarten. Alle Level, feste Zeiten, kein Studiovertrag.'),
  ('com-games', 'seed:leonie', 'Brettspiele Heidelberg', 'Spiele', 'Heidelberg', 'Abende mit Spielen, die man in einer Runde erklären kann.'),
  ('com-sauna', 'seed:therme', 'Sauna Mannheim', 'Wellness', 'Mannheim', 'Öffentliche Therme, klare Regeln, Freundschaft und kein Dating.')
on conflict (id) do nothing;

insert into community_members (community_id, user_id) values
  ('com-joggen', 'seed:mira'),
  ('com-cali', 'seed:mira'),
  ('com-games', 'seed:leonie'),
  ('com-sauna', 'seed:therme')
on conflict do nothing;

insert into activities (id, host_id, title, description, category, intent, place_name, city, lat, lng, starts_at, spots, image_url, booking_mode, community_id, public_place) values
  ('act-cali', 'seed:mira', 'Calisthenics im Stadtgarten', 'Basics an Ringen und Barren, alle Level. Wir teilen uns nach Erfahrung auf und hören nach etwa 70 Minuten auf. Danach optional Kaffee, kein Muss.', 'Sport', 'friends', 'Stadtgarten, Barrenwiese', 'Karlsruhe', 49.0128, 8.3995, '2026-10-18 10:00:00+02', 8, '/activities/calisthenics.jpg', 'request', 'com-cali', true),
  ('act-jog', 'seed:mira', 'Sonntagslauf, acht Kilometer', 'Ruhiges Tempo, eine Gehpause in der Mitte. Wenn du neu bist, sag das beim Start — die Gruppe wartet.', 'Outdoor', 'friends', 'Schlossgarten, Haupteingang', 'Karlsruhe', 49.0135, 8.4044, '2026-10-19 09:30:00+02', 12, '/activities/garden.jpg', 'request', 'com-joggen', true),
  ('act-brunch', 'seed:jonas', 'Brunch zu zweit', 'Ein Tisch am Fenster, eine Stunde, kein Programm danach. Du weißt vorher, dass es ein Date ist.', 'Essen', 'date', 'Café am Marktplatz', 'Karlsruhe', 49.0092, 8.4039, '2026-10-19 11:00:00+02', 1, '/activities/brunch.jpg', 'request', null, true),
  ('act-garden', 'seed:nora', 'Spaziergang im Schlossgarten', 'Eine Runde, ungefähr 45 Minuten, öffentlich und gut besucht. Danach kann jede Person einfach gehen.', 'Outdoor', 'date', 'Schlossgarten Karlsruhe', 'Karlsruhe', 49.0136, 8.4044, '2026-10-18 16:00:00+02', 1, '/activities/garden.jpg', 'request', null, true),
  ('act-climb', 'seed:amir', 'Klettern nach Feierabend', 'Einsteiger willkommen, Schuhe kann man leihen. Wir bleiben in der Halle und gehen nicht noch woanders hin.', 'Sport', 'friends', 'Kletterhalle West', 'Karlsruhe', 49.0025, 8.352, '2026-10-21 19:00:00+02', 3, '/activities/climb.jpg', 'request', null, true),
  ('act-cook', 'seed:tischlein', 'Herbstküche, kleiner Kurs', 'Suppe und ein Blech aus dem Ofen. Zutaten sind da, du bringst Appetit mit. Sofortbuchung, die Plätze sind echt begrenzt.', 'Essen', 'both', 'Küche an der Kaiserstraße', 'Karlsruhe', 49.0096, 8.385, '2026-10-22 18:30:00+02', 8, '/activities/cooking.jpg', 'instant', null, true),
  ('act-bike', 'seed:rheinrad', 'Rheinufer-Radtour', '25 Kilometer, flach, zwei Pausen. Leih räder stehen am Treffpunkt. Öffentliche Tour, Sofortbuchung.', 'Outdoor', 'both', 'Rheinufer, Neckarspitze', 'Mannheim', 49.4915, 8.456, '2026-10-18 14:00:00+02', 12, '/activities/bike.jpg', 'instant', null, true),
  ('act-games', 'seed:leonie', 'Brettspielabend', 'Zwei Spiele, erklärbar in fünf Minuten. Tee steht auf dem Tisch. Kein Dating, nur Leute die spielen wollen.', 'Spiele', 'friends', 'Café Kuckuck', 'Heidelberg', 49.4124, 8.7103, '2026-10-17 19:00:00+02', 5, '/activities/games.jpg', 'request', 'com-games', true),
  ('act-spa', 'seed:therme', 'Thermenabend ohne Programm', 'Gemeinsam hin, jeder badet für sich, hinterher ein Tee im Foyer. Freundschaft, kein Date. Sofortbuchung.', 'Wellness', 'friends', 'Therme Mannheim', 'Mannheim', 49.479, 8.475, '2026-10-19 15:00:00+02', 6, '/activities/spa.jpg', 'instant', 'com-sauna', true),
  ('act-past', 'seed:mira', 'Stadtgarten-Runde', 'Vergangenes Treffen, nur für Bewertungen.', 'Outdoor', 'friends', 'Stadtgarten', 'Karlsruhe', 49.0128, 8.3995, '2026-10-05 10:00:00+02', 6, '/activities/calisthenics.jpg', 'request', 'com-joggen', true)
on conflict (id) do nothing;

insert into ratings (id, activity_id, rater_id, ratee_id, punctual, respectful, matches_profile, want_again) values
  ('rat-mira', 'act-past', 'seed:guest', 'seed:mira', 5, 5, 5, true),
  ('rat-jonas', 'act-past', 'seed:guest', 'seed:jonas', 5, 4, 5, false),
  ('rat-nora', 'act-past', 'seed:guest', 'seed:nora', 4, 5, 5, true),
  ('rat-amir', 'act-past', 'seed:guest', 'seed:amir', 5, 5, 4, true),
  ('rat-leonie', 'act-past', 'seed:guest', 'seed:leonie', 5, 5, 5, true),
  ('rat-rhein', 'act-past', 'seed:guest', 'seed:rheinrad', 5, 5, 4, true),
  ('rat-tisch', 'act-past', 'seed:guest', 'seed:tischlein', 4, 5, 5, true),
  ('rat-therme', 'act-past', 'seed:guest', 'seed:therme', 5, 5, 5, true)
on conflict (id) do nothing;
