# MeeQo: Hinweise für KI-Programmierhilfen

Lies zuerst `meeqo-app/MEEQO-UEBERGABE.md` (Stand, Entscheidungen, Grenzen), dann bei Bedarf `meeqo-app/RECHERCHE.md` (Markt, Recht, Ideen), `meeqo-app/NATIVE-APPS.md` (Android/iOS) und `meeqo-app/DATENSCHUTZ-FOLGENABSCHAETZUNG.md`.
`meeqo-app/AGENTS.md` stammt von einer früheren Entwicklungsumgebung (Grok-Sandbox) und gilt hier **nicht**.

## Was MeeQo ist
Deutschsprachige App, in der Menschen sich über gemeinsame Aktivitäten treffen. Dating und Freundschaft getrennt, Absicht von Anfang an sichtbar, Beitritt nur auf Anfrage mit Zusage des Gastgebers, Vertrauen aus Ja/Nein-Bewertungen nach dem Treffen. **Kein Swipen, kein Crypto, keine Tokens, keine Werbung.** Beispielkarten tragen „Beispiel“. Start: Karlsruhe + 100 km, zuerst nur Freunde und Aktivitäten (Schalter unter `/admin/zahlen`).

## Stack und Orte
- TanStack Start (React 19, Vite, SSR, Dateirouten), Tailwind 4, better-auth, Postgres (im Vorschau-Betrieb PGLite). Alles Weitere in `meeqo-app/`.
- Serverlogik: `src/lib/meeqo/api.ts` (Server-Funktionen), Typen `types.ts`, Texte/Labels `labels.ts`.
- Datenbank nur über **neue** Dateien in `meeqo-app/migrations/` (nächste Nummer fortsetzen, nie alte ändern).
- Oberfläche: `src/routes/*`, `src/components/*`. Farben: Hintergrund `#F7F1EA`, Akzent `#E07A5F`, weiße Karten, schwebende Leiste unten.

## Regeln
1. Texte in der Oberfläche auf Deutsch, mit `t("deutscher Text {0}", wert)`; Englisch steht in `tools/en/part*.json` → `node tools/i18n-merge.mjs`. Danach `node tools/i18n-missing.mjs` muss 0 melden.
2. Sicherheit und Datenschutz zuerst: 18+, Einwilligung für sensible Angaben (Art. 9), Blockieren/Melden, Raten-Limits (`throttle`). Neue Tabellen mit Personenbezug in `deleteAccount` und `exportMyData` ergänzen.
3. Nichts Neues erfinden, ohne dass die bestehenden Muster geprüft wurden. Kleine, gezielte Änderungen.
4. Vor jedem Push: `npx tsc --noEmit`, `npm run test:unit`, bei Oberflächenänderungen `npm run test:e2e` (Server mit `ADMIN_EMAILS=admin@test.de npm run dev` auf Port 8080 starten, `CHROME_PATH` auf Chromium setzen). E2E laufen nacheinander.
5. Nicht verfügbar in der Entwicklungsumgebung und daher ungetestet: Push, Mail, Orts-Dienste im Netz, App-Bau, Store-Einreichung. Das nie als „getestet“ melden.
6. Rechtstexte (Impressum, Datenschutz, AGB) sind Entwürfe und müssen von Fachleuten geprüft werden.

## Befehle (in `meeqo-app/`)
```
npm install
ADMIN_EMAILS=admin@test.de npm run dev      # http://localhost:8080
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run build
```
