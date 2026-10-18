-- Mitteilungen pro Art und Kanal (Push / E-Mail) plus Ruhezeiten. Leeres JSON = Standardwerte aus notify-prefs.ts.
alter table profiles add column if not exists notify_prefs text not null default '{}';
alter table profiles add column if not exists quiet_on boolean not null default true;
alter table profiles add column if not exists quiet_from integer not null default 22;
alter table profiles add column if not exists quiet_to integer not null default 8;
