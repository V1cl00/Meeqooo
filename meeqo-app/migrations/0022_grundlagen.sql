-- Keine neuen Tabellen: die Warteliste und "entfernt" sind neue Werte fuer join_requests.status,
-- und Aenderungen an Treffen laufen ueber die bestehenden Spalten.
-- Index fuer die Warteliste: wer wartet am laengsten.
create index if not exists join_requests_waitlist_idx on join_requests (activity_id, status, created_at);
