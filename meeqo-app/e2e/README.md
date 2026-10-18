# Browser-Tests

Echte Durchläufe mit zwei Konten: Alter, Kleinanzeigen-Chat (live), Treffen anlegen, Anfrage mit Tempo, Zusage,
Bestätigung am Vortag, Vertrauens- und Einladungslink, Serie, Melden, Blockieren, Konto löschen, Moderation.

```
ADMIN_EMAILS=admin@test.de npm run dev     # Port 8080, eigener Terminal
npm run test:e2e                            # in einem zweiten
```

- Der Dev-Server nutzt die Datenbank im Arbeitsspeicher. Jeder Lauf legt neue Konten an, der Admin `admin@test.de` bleibt bestehen.
- Läuft der Server woanders, `BASE_URL=http://localhost:3000 npm run test:e2e` (die Anmeldung erlaubt nur die erlaubten Adressen).
- Ohne eingebauten Chromium: `CHROME_PATH=/pfad/zu/chrome npm run test:e2e`.

Englisch: `node --test e2e/english.test.mjs` (Browser mit en-GB). Die Hilfsfunktion `launch()` stellt alle anderen Kontexte auf de-DE.
