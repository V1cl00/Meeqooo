create table if not exists posts (
  id text primary key,
  author_id text not null,
  community_id text,
  body text not null,
  audience text not null default 'both',
  created_at timestamptz not null default now()
);

create index if not exists posts_author_idx on posts (author_id, created_at desc);
create index if not exists posts_community_idx on posts (community_id, created_at desc);

insert into posts (id, author_id, community_id, body, audience, created_at) values
  ('post-mira', 'seed:mira', null, 'Sonntag laufe ich wieder die acht Kilometer. Wer neu ist, sagt das am Start — wir warten.', 'friends', '2026-10-14 18:10:00+02'),
  ('post-jonas', 'seed:jonas', null, 'Brunch am Marktplatz bleibt ein Date. Eine Stunde, kein Programm danach.', 'date', '2026-10-13 20:40:00+02'),
  ('post-nora', 'seed:nora', null, 'Schlossgarten ist gut besucht. Wenn du lieber gehst als bleibst, ist das in Ordnung.', 'date', '2026-10-12 16:05:00+02'),
  ('post-jog', 'seed:mira', 'com-joggen', 'Treffpunkt bleibt der Haupteingang. Bei Regen laufen wir trotzdem, nur eine Runde kürzer.', 'friends', '2026-10-14 09:15:00+02'),
  ('post-cali', 'seed:mira', 'com-cali', 'Ringe sind frei. Wer die Basics noch nicht kann, bleibt bei mir an der Stange.', 'friends', '2026-10-13 12:00:00+02'),
  ('post-games', 'seed:leonie', 'com-games', 'Am Freitag erklären wir zwei kurze Spiele. Bitte pünktlich, die Runde wartet nicht ewig.', 'friends', '2026-10-12 19:30:00+02'),
  ('post-sauna', 'seed:therme', 'com-sauna', 'Foyer-Tee nach dem Bad. Handtuch mitbringen, Dating bleibt draußen.', 'friends', '2026-10-11 11:20:00+02')
on conflict (id) do nothing;
