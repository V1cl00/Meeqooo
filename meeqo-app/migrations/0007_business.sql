insert into communities (id, owner_id, name, topic, city, description) values
  ('com-afterwork', 'seed:jonas', 'Afterwork Karlsruhe', 'Business · Afterwork', 'Karlsruhe', 'Ein Feierabend, ein Tisch, kein Pitch. Wer will, sagt was er macht. Wer nicht, hört zu.')
on conflict (id) do nothing;

insert into community_members (community_id, user_id) values
  ('com-afterwork', 'seed:jonas')
on conflict do nothing;

insert into activities (id, host_id, title, description, category, intent, place_name, city, lat, lng, starts_at, spots, image_url, booking_mode, community_id, public_place) values
  ('act-afterwork', 'seed:jonas', 'Afterwork ohne Pitch', 'Ein Tisch in der Kaiserstraße, eine Stunde. Jede Person sagt in einem Satz, woran sie arbeitet, dann ist es ein normales Gespräch. Freundschaft, kein Date.', 'Business · Afterwork', 'friends', 'Café an der Kaiserstraße', 'Karlsruhe', 49.0094, 8.391, '2026-10-20 18:30:00+02', 6, '/activities/brunch.jpg', 'request', 'com-afterwork', true)
on conflict (id) do nothing;
