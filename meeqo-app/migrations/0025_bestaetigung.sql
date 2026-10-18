-- Bestaetigung am Vortag: wann wurde gefragt. Wer nicht antwortet und einen Platz blockiert, waehrend andere warten, gibt ihn frei.
alter table join_requests add column if not exists confirm_asked_at timestamptz;
