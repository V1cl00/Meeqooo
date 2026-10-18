-- Keine Benachrichtigungs-Mails mehr (nur Push und die Glocke in der App). Konto-Mails (Login-Link, Passwort) kommen weiter aus der Anmeldung.
alter table profiles alter column notify_email set default false;
update profiles set notify_email = false where notify_email is distinct from false;
