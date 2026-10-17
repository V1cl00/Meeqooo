-- Meldungen bearbeiten: Status und wer wann was getan hat.
alter table reports add column if not exists status text not null default 'open';
alter table reports add column if not exists action text not null default '';
alter table reports add column if not exists handled_at timestamptz;

-- Gesperrte Konten koennen die App nicht mehr benutzen.
alter table profiles add column if not exists suspended boolean not null default false;
