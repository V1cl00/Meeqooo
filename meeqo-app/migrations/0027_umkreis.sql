-- Neue Profile starten mit 60 km Umkreis: im Startgebiet ist die Dichte noch gering.
alter table profiles alter column radius_km set default 60;
