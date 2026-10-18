# Mit einer anderen KI weiterbauen

Der gesamte Stand liegt auf GitHub: **V1cl00/Meeqooo**, Zweig **`ccr-4bc4b9f8-pjda48`** (neuester Stand; `main` ist älter). Die KI braucht nur Zugriff auf diesen Code. Alles, was sie wissen muss, steht in den Dateien, nicht in diesem Chat.

## Schritte
1. **Zweig übernehmen.** Entweder den Zweig `ccr-4bc4b9f8-pjda48` nach `main` zusammenführen (auf GitHub „Pull request“ öffnen und mergen) oder die KI direkt auf diesem Zweig arbeiten lassen. Ich habe keinen Pull Request angelegt, weil du das nicht verlangt hast.
2. **Werkzeug wählen.** Jedes, das ein Git-Projekt öffnen, Befehle ausführen und Dateien ändern kann:
   - **Claude Code** (Terminal, Web oder Desktop): liest `AGENTS.md` im Hauptordner nicht automatisch, deshalb den Startsatz unten einfügen.
   - **OpenAI Codex / Codex CLI:** liest `AGENTS.md` automatisch.
   - **Cursor, Windsurf, GitHub Copilot, Gemini CLI, Aider:** `AGENTS.md` bzw. den Startsatz nutzen (Gemini: Datei als `GEMINI.md` kopieren).
3. **Lokal einrichten** (einmalig): Node 20+, dann in `meeqo-app/` `npm install` und `ADMIN_EMAILS=admin@test.de npm run dev`. Für Browser-Tests Chromium installieren (`npx playwright install chromium`) und `CHROME_PATH` setzen.
4. **Startsatz einfügen:**

> Du arbeitest an MeeQo, einer bestehenden App im Ordner `meeqo-app/` (Zweig `ccr-4bc4b9f8-pjda48`). Lies zuerst `AGENTS.md` im Hauptordner und `meeqo-app/MEEQO-UEBERGABE.md`. Erfinde nichts neu und wechsle den Stack nicht. Halte dich an die Regeln dort (Deutsch, kein Swipen/Crypto, Datenschutz zuerst, neue Datenbankänderungen nur als neue Datei in `migrations/`). Führe vor jedem Commit `npx tsc --noEmit` und `npm run test:unit` aus, bei Oberflächenänderungen auch `npm run test:e2e`. Melde ehrlich, was du nicht testen konntest. Aufgabe: …

## Worauf du achten solltest
- **Qualität prüfen.** Jede andere KI macht eigene Fehler. Lass sie immer die Tests laufen und zeig dir die Ergebnisse. Die Browser-Tests (`e2e/`) fangen viel ab.
- **Geheimnisse nie in den Chat oder ins Repository.** API-Schlüssel (Firebase, Mail, Datenbank) gehören in die Umgebungsvariablen des Hosters, nicht in Dateien.
- **Offene Aufgaben** stehen am Ende von `MEEQO-UEBERGABE.md` und in `RECHERCHE.md` (Abschnitt „Was daraus folgt“). Wichtigste Punkte: Hoster und Domain, Datenschutz-Prüfung durch Fachleute, Push-/Mail-Schlüssel, SMS-Bestätigung, Altersnachweis, App-Bau für Android und iOS.
- **Der Code gehört dir.** Er liegt in deinem GitHub-Konto; du kannst jederzeit zu einer anderen KI oder einem Menschen wechseln.
