# MeeQo

Menschen lernen sich über echte Aktivitäten kennen, nicht über Profil-Swipes. Dating und Freundschaft sind getrennt, die Absicht ist von Anfang an sichtbar, mitmachen geht nur über eine Anfrage mit Freigabe.

Die App liegt in [`meeqo-app/`](meeqo-app). Stand und Regeln für Mitarbeitende: [`meeqo-app/MEEQO-UEBERGABE.md`](meeqo-app/MEEQO-UEBERGABE.md).

## Stack

TanStack Start (React 19, Vite, SSR), Tailwind 4, better-auth, Postgres (in der Vorschau PGLite im Arbeitsspeicher). Serverlogik in `src/lib/meeqo/api.ts`, Schema nur über neue Dateien in `migrations/`.

## Lokal starten

```
cd meeqo-app
npm install
npm run dev          # http://localhost:8080
```

Die Datenbank liegt im Arbeitsspeicher. Jeder Neustart leert sie und baut sie aus den Migrationen samt Beispieldaten neu auf. Für Tests auf dem Handy im WLAN: `BETTER_AUTH_URL=http://<IP>:8080 npm run dev`.

## Umgebungsvariablen

| Variable | Wofür | Ohne |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (Neon), sonst PGLite | Vorschau-Datenbank, Daten weg beim Neustart |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Anmeldung in Produktion | wie vom Deployer gesetzt |
| `ADMIN_EMAILS` | Wer `/admin/meldungen` und `/admin/zahlen` sehen darf (kommagetrennt) | niemand ist Admin |
| `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` | Mails (Passwort vergessen, Anfragen, Zusagen) | es wird nichts gesendet |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web-Push (`npx web-push generate-vapid-keys`) | Mitteilungen nur bei offener App |
| `XAI_API_KEY` | KI für Design-Wünsche, Hilfe und Vorschläge | diese Teile fallen auf einfache Regeln zurück |

## Betrieb

- **Moderation:** Meldungen landen in `/admin/meldungen` (Abweisen, Inhalt entfernen, Konto sperren). Wer meldet, bekommt danach eine Mitteilung. Sichtungszeit festlegen und einhalten.
- **Zahlen:** `/admin/zahlen` zeigt Konten, Onboarding, Anfragen und vor allem Anfragen, die länger als 24 Stunden unbeantwortet sind. Das ist der Wert, der Leute vergrault.
- **Fehler:** Browser-Fehler werden in `error_log` gesammelt und in den Zahlen angezeigt. Serverfehler stehen im Log des Hosters.
- **Bestätigt-Abzeichen:** setzt nur ein Admin (Knopf auf dem Profil), nie die Person selbst.
- **Backups:** Der Datenbank-Anbieter muss tägliche Sicherungen und Wiederherstellung anbieten. Wiederherstellung einmal proben.
- **Löschen und Auskunft:** Konto löschen und „Meine Daten“ gibt es in den Einstellungen. Wer eine Tabelle mit Personenbezug anlegt, ergänzt `deleteAccount` und `exportMyData`.

## Sprachen (Deutsch, Englisch)

- Der deutsche Text ist der Schlüssel: `t("Text {0}", wert)` aus `src/lib/meeqo/i18n.ts`. Englisch steht in `src/lib/meeqo/en.ts`, erzeugt aus `meeqo-app/tools/en/part*.json` mit `node tools/i18n-merge.mjs`.
- Neue Texte: `t()` verwenden, dann `node tools/i18n-missing.mjs` (fehlende Übersetzungen) und `node tools/i18n-leftovers.mjs` (nicht eingepackte Strings) ausführen. Neue Texte kommen in eine neue `partN.json`.
- Die Sprache folgt dem Browser und lässt sich in den Einstellungen umschalten. Der Server rendert immer Deutsch, Englisch wird direkt nach dem Laden gesetzt.
- Bewusst nur Deutsch: Impressum, Datenschutz, Nutzungsbedingungen, Regeln, Mitteilungen/Mails, Link-Vorschauen der Einladung. Der Satz im Anlegen-Formular versteht deutsch und englisch.

## Tests

```
npm run typecheck
npm run test:unit    # Orte, Kalender, Sommerzeit
npm run test:e2e     # Browser-Durchläufe mit zwei Konten plus englische Oberfläche, siehe meeqo-app/e2e/README.md
```

`npm test` führt zusätzlich Prüfungen der Grok-Arbeitsumgebung aus und schlägt ohne diese Umgebung fehl.

## Vor dem öffentlichen Start

- Impressum ausfüllen, Datenschutz und Nutzungsbedingungen rechtlich prüfen lassen.
- Mail-Dienst, VAPID-Schlüssel und Datenbank-Sicherungen einrichten.
- Entscheiden, wie Verifizierung funktionieren soll (Foto-Abgleich, Ausweis für Veranstalter) und welche automatische Bildprüfung läuft.
