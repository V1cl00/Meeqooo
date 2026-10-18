-- Wann der Gastgeber geantwortet hat (fuer "antwortet meist innerhalb von ...").
alter table join_requests add column if not exists responded_at timestamptz;

-- Wann jemand am Vortag bestaetigt hat, dass er kommt.
alter table join_requests add column if not exists confirmed_at timestamptz;
