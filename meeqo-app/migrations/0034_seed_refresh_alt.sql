-- Testdaten: die ursprünglichen Seed-Treffen aus 0002/0007 bleiben über seed_schedule aktuell (Wochentakt, siehe seed-refresh.ts).
-- act-past bleibt absichtlich in der Vergangenheit (Bewertungen hängen daran). Entfernen: siehe MEEQO-UEBERGABE.md.
insert into seed_schedule (activity_id, offset_min, period_days)
select id, 0, 7 from activities
where host_id like 'seed:%' and id like 'act-%' and id not like 'act-s-%' and id <> 'act-past'
on conflict (activity_id) do nothing;
