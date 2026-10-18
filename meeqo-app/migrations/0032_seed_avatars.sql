-- Testdaten: KI-generierte Profilfotos für die Seed-Profile (user_id beginnt mit 'seed:').
-- Die Bilder liegen unter public/seed/avatars/ und sind KEINE echten Personen.
-- Vor dem Launch entfernen: Seed-Profile löschen (user_id like 'seed:%') und public/seed/ löschen.
update profiles set avatar_url = '/seed/avatars/' || substr(user_id, 6) || '.webp'
where user_id in ('seed:mira', 'seed:jonas', 'seed:nora', 'seed:amir', 'seed:leonie', 'seed:rheinrad', 'seed:tischlein', 'seed:therme')
  and avatar_url = '';
