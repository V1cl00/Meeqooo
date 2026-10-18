-- Dateien im Chat: Bild (JPEG/PNG) oder PDF, direkt an der Nachricht. Der Inhalt wird nur auf Abruf geladen.
alter table messages add column if not exists attachment_name text;
alter table messages add column if not exists attachment_type text;
alter table messages add column if not exists attachment_data text;
