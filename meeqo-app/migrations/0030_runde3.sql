-- Runde 3: Vertrauen, Mindestgröße, kurzes Onboarding, nach dem Treffen, Erinnerungen, Zahlen.

-- Selfie-Prüfung: ein Admin vergleicht Selfie und Profilfoto. Das Selfie wird nach der Entscheidung gelöscht.
create table if not exists selfie_checks (
  user_id text primary key,
  image text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Nach dem Treffen: war da, war nett, nochmal mit der Gruppe, Gruppe behalten. Keine Sterne, nichts Öffentliches pro Person.
create table if not exists meet_feedback (
  activity_id text not null,
  user_id text not null,
  was_there boolean not null default true,
  was_nice boolean,
  again_group boolean,
  keep_group boolean not null default false,
  host_there boolean,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- Gruppe behalten: entsteht, wenn mindestens zwei aus dem Treffen zustimmen.
alter table communities add column if not exists from_activity text;
alter table communities add column if not exists private boolean not null default false;

-- Mindestgröße: unter N Zusagen steht „Noch N Leute, dann findet es statt“.
alter table activities add column if not exists min_people integer not null default 0;

-- Kurzes Onboarding: Stadtteil, später Sprachen.
alter table profiles add column if not exists district text not null default '';
alter table profiles add column if not exists languages text not null default '[]';
alter table profiles add column if not exists profile_more_seen boolean not null default false;

-- Mitteilungen: abschaltbar, jede höchstens einmal.
alter table profiles add column if not exists notify_reminder boolean not null default true;
alter table profiles add column if not exists notify_nearby boolean not null default true;
create table if not exists nudges_sent (
  user_id text not null,
  kind text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

-- Zahlen ohne Dritt-Dienst: eine Zeile pro Konto, Schritt und Tag.
create table if not exists funnel_events (
  user_id text not null,
  kind text not null,
  day date not null,
  primary key (user_id, kind, day)
);

-- Orte aus der Recherche (öffentliche Angaben, keine Kontaktdaten). Nur als Vorlagen für Admins und als Ortsseiten.
create table if not exists venues (
  id text primary key,
  name text not null,
  kind text not null default '',
  address text not null default '',
  district text not null default '',
  website text not null default '',
  idea text not null default ''
);
insert into venues (id, name, kind, address, district, website, idea) values
('venue-boulderhalle-steil', 'Boulderhalle Steil', 'Kletter-/Boulderhalle', 'Hardeckstr. 8, KA-Grünwinkel', 'Grünwinkel', 'https://boulderhalle-steil.com/', 'Boulder-Schnupperabend für Einsteiger (Mi)'),
('venue-the-rock-kletterzentrum', 'THE ROCK Kletterzentrum', 'Kletter-/Boulderhalle', 'Ziegelstr. 1, KA (+ Boulderhalle Durlach)', '', 'https://www.kletterhalle-karlsruhe.de/', 'Toprope-Schnupperkurs zu zweit'),
('venue-boulderwelt-karlsruhe', 'Boulderwelt Karlsruhe', 'Kletter-/Boulderhalle', 'Karlstr. 14, KA-Innenstadt-West', 'Innenstadt-West', 'https://www.boulderwelt-karlsruhe.de/', 'After-Work-Bouldern Mo/Di mit Intro'),
('venue-dav-kletter-und-boulderzentrum-karlsruhe', 'DAV Kletter- und Boulderzentrum Karlsruhe', 'Kletter-/Boulderhalle', 'Am Fächerbad 2, KA-Hagsfeld', 'Hagsfeld', 'https://www.dav-kletterzentrum-karlsruhe.de/', 'Einsteiger-Kletterkurs für Kleingruppen'),
('venue-waldseilpark-karlsruhe', 'Waldseilpark Karlsruhe', 'Outdoor/Kanu', 'KA-Durlach', 'Durlach', 'https://www.waldseilpark-karlsruhe.de/', 'Hochseilgarten-Nachmittag in Kleingruppen'),
('venue-adventurebox-karlsruhe', 'Adventurebox Karlsruhe', 'Escape Room', 'Kaiserallee 21, KA-Weststadt', 'Weststadt', 'https://adventurebox-karlsruhe.de/', 'Escape-Room für 4–6 Meeqo-Nutzer:innen, die sich noch nicht kennen'),
('venue-cage-quests-karlsruhe', 'CAGE QUESTS Karlsruhe', 'Escape Room', 'Durlacher Allee 34, KA', '', 'https://cagequests.de/karlsruhe/', 'Wizards Secrets als Gruppenabend unter der Woche'),
('venue-escape-rooms-karlsruhe-funpark', 'Escape Rooms Karlsruhe (Funpark)', 'Escape Room', 'Karlsruhe', '', 'https://www.escaperooms-karlsruhe.de/', 'Midweek-Escape (Di/Mi) für neue Gruppen'),
('venue-kuche-und-genuss', 'Küche und Genuss', 'Kochschule', 'Poststr., KA-Südweststadt', 'Südweststadt', 'https://kuecheundgenuss.de/', 'Gemeinsamer Kochabend mit Menü für Singles (Date mode)'),
('venue-catch-event-kochschule', 'CATCH Event-Kochschule', 'Kochschule', 'KA-Durlach', 'Durlach', 'https://www.catch-kocht.com/', 'Team-Kochabend für neue Freundesgruppen'),
('venue-kochschule-fallah', 'Kochschule Fallah', 'Kochschule', 'Karlsruhe-Innenstadt', '', 'https://kochschulefallah.de/', 'Länderküchen-Abend in Kleingruppe'),
('venue-be-yogi', 'be yogi', 'Yoga/Achtsamkeit', 'Kriegsstr. 86 & Ahaweg 2, KA', '', 'https://www.beyogi.de/', 'Yoga & Tee danach (Community-Klasse)'),
('venue-muktimind-yoga-therapy', 'muktimind yoga & therapy', 'Yoga/Achtsamkeit', 'KA-Weststadt (Gutenbergplatz)', 'Weststadt', 'https://www.muktimind.de/', 'Achtsamkeits-Workshop für Neu-Karlsruher'),
('venue-yogasangat-raum-fur-yoga-und-klang', 'YogaSangat – Raum für Yoga und Klang', 'Yoga/Breathwork', 'Gartenstr. 72, KA-Südweststadt', 'Südweststadt', 'https://yogasangat.de/', 'Breathwork-Session + Austausch'),
('venue-our-class', 'our.class', 'Yoga/Fitness', 'KA-Südweststadt / Durlach', 'Südweststadt', 'https://ourclass.de/', 'Hot-Yoga-Class + Smoothie danach'),
('venue-taoversity', 'Taoversity', 'Yoga/Achtsamkeit', 'KA-Oststadt', 'Oststadt', 'https://taoversity.de/', 'Restorative-Yoga-Abend am Mittwoch'),
('venue-urban-yoga-karlsruhe', 'Urban Yoga Karlsruhe', 'Yoga/Achtsamkeit', 'KA-Innenstadt / Daxlanden', 'Innenstadt', 'https://urbanyoga-karlsruhe.de/', 'Vinyasa-Flow für Einsteiger + Café danach'),
('venue-die-spielgefahrten', 'Die Spielgefährten', 'Brettspiel/Gaming', 'Events in KA (z. B. Kneipenquiz Sir George''s Pub)', '', 'https://www.diespielgefaehrten.de/', 'Meeqo-Quizteam-Abend (Teams aus Fremden)'),
('venue-thoule-rollen-und-brettspielverein', 'Thoule – Rollen- und Brettspielverein', 'Brettspiel/Gaming', 'Ostendstr. 1, KA', '', 'https://thoule.de/', 'Brettspielabend für Einsteiger:innen'),
('venue-quino-karlsruhe', 'Quino Karlsruhe', 'Brettspiel/Gaming', '76137 Karlsruhe', '', 'https://quino-karlsruhe.de/', 'Spielecafé-Nachmittag'),
('venue-z10-studentenzentrum', 'Z10 Studentenzentrum', 'Brettspiel/Gaming', 'Karlsruhe', '', 'https://z10.info/', 'Spieleabend Mi im Café'),
('venue-nun-kulturraum', 'NUN Kulturraum', 'Bar/Café mit Events', 'Gottesauer Str. 35, KA-Oststadt', 'Oststadt', 'https://nun.cafe/', 'Quizabend-Tisch für Meeqo-Gruppen'),
('venue-kulturkuche-karlsruhe', 'Kulturküche Karlsruhe', 'Bar/Café mit Events', 'Kaiserstr. 47, KA', '', 'https://kulturkueche-karlsruhe.de/', 'Mitmach-/Spieleabend unter der Woche'),
('venue-yollie-cafe', 'Yollie Café', 'Bar/Café mit Events', 'Waldstr. 85, KA', '', 'https://www.yollie.cafe/', 'Latte-Art-Workshop als entspanntes Date'),
('venue-die-stadtmitte', 'Die Stadtmitte', 'Bar/Café mit Events', 'Karlsruhe', '', 'https://die-stadtmitte.de/', 'Konzertabend mit Meeqo-Treffpunkt'),
('venue-happy-pottery', 'Happy Pottery', 'Workshop (Töpfern/Malen)', 'Amalienstr. 45, KA', '', 'https://happypottery.de/', 'Drehscheiben-Schnupperkurs zu zweit'),
('venue-keramik-dauerschon', 'Keramik Dauerschön', 'Workshop (Töpfern/Malen)', 'Herrenstr. 29, KA', '', 'https://www.keramik-dauerschoen.de/', 'Handaufbau-Workshop für Kleingruppe'),
('venue-kokolo-art-paint-wine', 'kokolo Art – Paint & Wine', 'Workshop (Töpfern/Malen)', 'Karlsruhe (Impressum Stutensee)', '', 'https://www.kokolo-art.de/', 'Paint-&-Wine-Abend (Date mode)'),
('venue-malbar-karlsruhe', 'Malbar Karlsruhe', 'Workshop (Töpfern/Malen)', 'Karlsruhe', '', 'https://malbar-karlsruhe.de/', 'Acryl-Malabend für Einsteiger'),
('venue-bbk-karlsruhe', 'BBK Karlsruhe', 'Workshop (Töpfern/Malen)', 'KA', '', 'https://bbk-karlsruhe.de/', 'Freies Zeichnen in Kleingruppe'),
('venue-tanzloft-karlsruhe', 'Tanzloft Karlsruhe', 'Tanzschule', 'Durmersheimer Str. 159, KA', '', 'https://karlsruhe.tanz-loft.de/', 'Discofox-Bootcamp ohne festen Partner'),
('venue-tanzando', 'Tanzando', 'Tanzschule', 'Douglasstr. 24/26, KA', '', 'https://tanzando.de/', 'Probestunde für Singles'),
('venue-havanna-star', 'Havanna Star', 'Tanzschule', 'Bannwaldallee 14, KA', '', 'https://www.havannastar.de/', 'Salsa-Workshop + Party'),
('venue-vogelmann-adventure', 'Vogelmann Adventure', 'Outdoor/Kanu', 'Walzbachtal (Touren um KA)', '', 'https://vogelmann-adventure.de/', 'Kanutour Eggenstein-Leopoldshafen (3er-Kanu)'),
('venue-paddelfritz', 'Paddelfritz', 'Outdoor/Kanu', 'Bad Liebenzell (Touren um KA)', '', 'https://fritzandshop.de/verleih/index.html', 'SUP-/Kajak-Tour auf der Alb'),
('venue-tollhaus-karlsruhe', 'TOLLHAUS Karlsruhe', 'Kultur/Event', 'Karlsruhe', '', 'https://tollhaus.de/', 'Gemeinsamer Konzert-/Comedy-Besuch'),
('venue-substage', 'Substage', 'Kultur/Event', 'Karlsruhe', '', 'https://substage.de/', 'Konzertabend für Musik-Matches'),
('venue-kohi-kulturraum', 'KOHI Kulturraum', 'Kultur/Event', 'Karlsruhe', '', 'https://kohi.de/', 'Kleinkunst-Abend in Gruppe'),
('venue-jubez', 'Jubez', 'Kultur/Event', 'Kronenplatz, KA', '', 'https://jubez.de/', 'Workshop-/Kulturabend 18–25')
on conflict (id) do nothing;
