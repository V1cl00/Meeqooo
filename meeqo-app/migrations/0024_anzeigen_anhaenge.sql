-- Dateien auch in Anzeigen-Chats (wie bei messages).
alter table classified_messages add column if not exists attachment_name text;
alter table classified_messages add column if not exists attachment_type text;
alter table classified_messages add column if not exists attachment_data text;
