# MeeQo — Übergabe an eine andere KI

Stand: 17. Oktober 2026, Projekt in `/workspace`. Deutschsprachige App. Der Nutzer spricht Deutsch und will kurze, direkte Antworten. Nicht belehren. Nicht nach jeder Änderung fragen, ob es so gemeint war. Vorhandenes Design und die Produktregeln nicht umbauen, außer er verlangt es.

## Was MeeQo ist

MeeQo ist keine Swipe-Dating-App. Leute treffen sich über eine konkrete Aktivität (Laufen, Essen, Spiele, Business, Kleinanzeige, Veranstaltung). Dating und Freundschaft sind getrennt. Absicht ist von Anfang an sichtbar.

Kernregeln, die nicht aufgeweicht werden:

- Kein Profil-Swipen, kein Token, keine Krypto.
- Date-Aktivitäten sehen nur Leute, die Dating wollen. Freunde-Aktivitäten nur Leute, die Freundschaft wollen. „Beides“ sehen alle.
- Niemand nimmt einfach teil. Normale Nutzer: Anfrage, der Ersteller sagt ja oder nein, dann Chat. Veranstalter dürfen pro Aktivität „Anfrage“ oder „Sofortbuchung“ wählen.
- Erstes 1:1-Date nur an einem öffentlichen Ort. Check-in und Notfall-Button (Anruf 112) gehören dazu.
- Vertrauen kommt aus Bewertungen nach echten Treffen, nicht aus Selbstbeschreibung.
- Der Nutzer kann Aktivitäten dauerhaft ausblenden, mit Rückgängig.
- Beiträge haben eine Zielgruppe. „Wer darf das sehen?“ ist: Egal, Nur Freunde, Communities, Veranstaltungen, Mein Alter (±5 Jahre, Geburtsjahr bleibt privat).
- Bei Communities muss man die Gruppen auswählen können, mehrere gleichzeitig. Gespeichert in `audience_ids` (JSON-Text). Sehen kann es nur, wer in mindestens einer gewählten Gruppe Mitglied ist. Ohne Auswahl und Sichtbarkeit „community“ kommt die Fehlermeldung „Wähl mindestens eine Community.“ Alte Zeilen ohne `audience_ids` fallen auf das bisherige Verhalten zurück.
- Eigenschaften wie vegan oder queerfreundlich sind Filter, keine Kategorien. „Mindestens“ blendet alles aus, was die Eigenschaft nicht hat. Gilt für Feed, Suche, Communities, Anzeigen.
- Wer postet, stellt ein, wer den Beitrag sieht. Auch nur Freunde, nur Communities, nur Leute vom gemeinsamen Treffen, nur ungefähres Alter.

## Stack

- TanStack Start (React 19, Vite, SSR, file routes). Serverfunktionen in `src/lib/meeqo/api.ts`.
- Auth: better-auth, E-Mail und Passwort. Routen unter `src/routes/api/auth/`.
- Datenbank: PGLite, eine In-Memory-Instanz pro Dev-Server-Prozess. Schema nur über `migrations/*.sql`. Neue Datei `0014_....sql`, nicht an alten Dateien herumschreiben. Angewendet wird sie, wenn `src/lib/db.ts` neu lädt. Die DB ist beim Neustart des Dev-Servers leer und wird aus den Migrationen inklusive Seed neu aufgebaut.
- Kein Supabase, kein Firebase. Das war ein offener Wunsch, ist nicht gebaut. Nicht heimlich einführen.
- Design: Tailwind v4, Tokens in `src/styles.css`. Hintergrund `#F7F1EA` (`bg-sand`), Akzent `#E07A5F` (`bg-accent`), Karten weiß (`bg-card`), Text `text-ink`, Hinweise `text-muted`. Mobile-first, max-w-lg, unten eine schwebende Tab-Leiste.
- Schrift: Fraunces für Titel (`font-display`), Source Sans 3 für UI.
- Buttons sind echte Flächen, nie nackte Wörter. Primitive: `Button`, `face`, `Field`, `TextInput`, `Note`, `Empty`, `ActivityCard`, `WelcomeHero` in `src/components/bits.tsx`.
- Preview: Dev-Server auf Port 8080, Proxy 8081. Nicht neu starten, außer der Server ist tot oder die Config ändert sich. Neustart löscht die In-Memory-Datenbank.
- Veröffentlichen kann nur der Nutzer über den Button in der Grok-Oberfläche. Die Handy-Version unter der veröffentlichten URL ist oft älter als dieser Workspace. Nicht behaupten, das Handy sei aktuell, solange er nicht neu veröffentlicht hat.

## Wichtige Dateien

- `src/lib/meeqo/api.ts` — fast die ganze Logik: Feed, Aktivitäten, Chat, Posts, Communities, Kleinanzeigen, Ortssuche, Sichtbarkeit.
- `src/lib/meeqo/types.ts` — Typen.
- `src/lib/meeqo/labels.ts` — Kategorien, Wochentage, Radius, Texte.
- `src/lib/meeqo/geo.ts` — kleine Stadtliste plus `matchCities`, `cityCoords`, `kmBetween`. Nur Fallback, nicht die einzige Ortssuche.
- `src/components/shell.tsx` — Login-Gate, Onboarding-Zwang, Tab-Leiste.
- `src/components/place-bar.tsx` — Standort und Radius im Feed, plus `PlaceSuggest`.
- `src/components/visibility.tsx` — „Wer darf das sehen?“ inklusive Community-Mehrfachauswahl.
- `src/components/when-bar.tsx` — Wochentage plus Kalender für zwei Monate.
- `src/routes/index.tsx` — Feed.
- `migrations/0002_meeqo.sql` bis `0013_audience.sql`.

## Navigation

Unten: Entdecken `/`, Kalender `/calendar`, Neu `/create` (erhöhter Akzent-Button), Chats `/chat`, Profil `/profile`.

Weitere Seiten: Login, Onboarding, Aktivität, Suche, Communities, Community-Detail, Freunde, Anfragen, Bewertung, Meine Aktivitäten, Benachrichtigungen, Einstellungen, Support, Kategorien, Veranstalter (`/organizer`, Register, Create), fremdes Profil `/profile/$id`.

## Feed

Linsen: Alles, Dating, Freunde, Essen, Business, Kleinanzeigen, Veranstaltungen. Darunter Unterkategorien, wenn die Linse welche hat.

Reihenfolge auf der Seite, absichtlich so:

1. Stadtname und Titel „Treffen in der Nähe“
2. Linsen und Unterkategorien
3. Wochentagsleiste (`WhenBar`)
4. Hinweis, wenn kein Profilfoto da ist
5. Die Treffen-Karten
6. Erst danach: wer einlädt, Ort/Radius, Suche, Filter „Mindestens“

Heute ist vorausgewählt. Ist an dem Tag nichts, sagt die leere Karte, an welchem nächsten Tag etwas liegt, mit Button „Diesen Tag zeigen“.

Karten: Foto, Titel über dem Bild, Absicht-Pille, bei Business/Kleinanzeigen/Veranstaltungen zusätzlich die Sparte, darunter Zeit, Ort, Gastgeber mit Foto oder Anfangsbuchstabe, erstes Vertrauens-Badge, freie Plätze. Ausblenden sitzt klein unter der Karte.

## Onboarding

Eine Frage: Wofür bist du hier? Mehrfachauswahl: Dating, Freunde, Business, Kleinanzeigen. Nicht mehr die drei alten Dating-Stufen als Pflicht. „Ich suche aktiv neue Leute für“ ist optional (Kategorien). Stadt über `PlaceSuggest`. Button „Standort nutzen“ ist ein echter Button. Der Name wird nur beim Konto angelegt, nicht noch einmal im Onboarding.

## Ort

Photon (`photon.komoot.io`) ist von diesem Server aus nicht erreichbar. Nicht wieder einbauen.

Aktuelle Suche in `suggestPlaces`:

- Lokale Städte aus `geo.ts` sofort.
- Deutsche Postleitzahlen und Orte über `https://openplzapi.org/de/Localities`.
- Koordinaten über `https://api.zippopotam.us/de/{plz}`, sonst Nominatim.
- Eine fünfstellige PLZ wie `76131` listet diese PLZ und die anderen PLZ derselben Stadt, jede als eigene Zeile unter dem Feld: `76131 Karlsruhe`, `76133 Karlsruhe`, …
- Unter vier Ziffern kommt der Hinweis, dass eine PLZ fünf Stellen hat.
- „Übernehmen“ speichert auch ohne angetippten Vorschlag. Eine nackte PLZ wird zu `76131 Karlsruhe`.
- Radius: 5, 10, 25, 40, 60, 100 km. Steht neben dem Ort auf jeder Feed-Linse.

## Chat

Liste und einzelne Nachrichten zeigen das Profilfoto, sonst den Anfangsbuchstaben. Gruppenchat ab 3 Personen oder mehr als 2 Plätzen, Badge „GRUPPE“. Der Chat öffnet sich erst nach Zusage. Offen und noch nicht gebaut: eine Reihe oben im Gruppenchat mit allen Teilnehmenden.

## Sicherheit und Teilnahme

- Aktivität veröffentlichen nur mit Foto.
- Anfragen nur mit Profilfoto. Sonst: „Ohne Foto kannst du nicht anfragen.“
- Auf der Treffenseite klebt „Anfragen“ bzw. „Chat“ über der Tab-Leiste. Bei 1:1-Dates zusätzlich der Button „112“.
- Check-in, danach Bewertung. Bewertung ist ein einfaches „Will ich wieder?“ plus die bestehenden Felder, nicht ein Formular-Monster.

## Design, das der Nutzer schon abgelehnt hat

- Nackte Text-Buttons.
- Große Stadt-Chips statt Suchfeld.
- Ein Kalender-Raster als eigene Hauptansicht. Gewünscht ist die Wochentagsleiste: heutiger Tag markiert, jeder Wochentag, Kalender-Icon für die nächsten zwei Monate, mehrere Tage per Wischen wählbar.
- Die Startseite als reine Schrift auf Sand. Es gibt `WelcomeHero`: Rahmen, Farbfläche, überlappende Beispielkarte mit dem Wort „Beispiel“. Das Beispiel-Treffen „Laufen, acht Kilometer“ ist erfunden und muss als Beispiel gekennzeichnet bleiben.
- Zweites Namensfeld im Onboarding.
- Drei Dating-Absichten im Onboarding statt Dating / Freunde / Business / Kleinanzeigen.

## Dichte-Runde (Migration 0014)

- `activities.area` (`meetup`, `business`, `event`) statt Textmuster. Setzt `createActivity` über `areaOf`. Linsen Business und Veranstaltungen filtern darauf.
- Kleinanzeigen: „Interesse melden“ legt einen Thread an (`classified_threads`, `classified_messages`), Route `/chat/anzeige/$id`, in der Chat-Liste mit Badge ANZEIGE. Ohne Profilfoto keine Anfrage. Übergabe-Vorschläge nur öffentliche Orte.
- „Nächste Woche nochmal“ für Gastgeber (`repeatActivity`).
- Leerer Feed: „Ich hätte Lust“ (`wishes`). Ab drei Leuten pro Kategorie und Stadt bekommt die erste Person einen Hinweis.
- Tempo: Anfrage trägt `join_requests.mood` (Locker, Gespräch, Sport, Nur Essen), der Ersteller sieht es unter Anfragen.
- Vertrauensperson: `safety_shares`, öffentliche Seite `/sicher/$token` ohne Login. Schlägt an, wenn 30 Minuten nach Beginn der Check-in fehlt. Kein Push, die Seite lädt sich selbst neu.
- Wieder getroffen: `listCircle`, nur gegenseitiges Ja, steht auf `/friends`.
- Ortslogik liegt in `src/lib/meeqo/places.ts` mit Tests (`places.test.ts`, gemocktes fetch).

## Schutz-Runde (Migration 0015)

- Melden und Blockieren: `reports`, `blocks`, Komponente `src/components/safety.tsx` (Treffen, Profil, Anzeige, Anzeigen-Chat). Blockieren gilt beidseitig: Feed, Anzeigen, Treffen-Detail, Anfragen, Freundschaft, Profil, Anzeigen-Chat. Es gibt noch keine Oberfläche, die Meldungen liest, nur die Tabelle.
- Konto löschen in den Einstellungen (`deleteAccount`), Tippen von LÖSCHEN. Neue Tabelle? Dann dort die Löschung ergänzen.
- `/datenschutz` und `/impressum` sind Entwürfe. Impressum hat Platzhalter in eckigen Klammern. Datenschutz beschreibt, was der Code speichert. Ändert sich das, die Seite mitziehen.
- Einladung: `/einladung/$token` ist öffentlich, zeigt nur Titel, Zeit, Ort, Vorname des Gastgebers. `login?next=` leitet danach weiter.
- Serie: `repeatActivity` mit `weeks` (1 bis 12). Beim Wiederholen werden Fotos mitkopiert.
- Karte: erster Chip ist „X von Y wollen wieder“ ab drei Bewertungen.
- Web-Push: `public/sw.js`, `push_subscriptions`, Versand in `notify`. Braucht `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Schlüssel mit `npx web-push generate-vapid-keys`). Ohne Schlüssel passiert nichts und nichts bricht. Zustellung ist nicht live getestet.
- Fotos der Treffen kommen als `/media/activity/$id` (cachebar) statt als Text im Feed. Die Adresse ist ohne Anmeldung abrufbar, wer die UUID kennt, sieht das Foto.

## Start schneller

- `src/lib/meeqo/warm.ts` startet Profil und Standard-Feed beim Laden des Skripts, parallel zur Sitzungsprüfung. Ergebnisse gelten 15 Sekunden und einmal.
- `ensureProfile` hat einen schnellen Pfad. `getFeed` und `getActivity` fragen parallel. `loadRows` kann nach Zeit und Id eingrenzen.
- Schriften kommen von `@fontsource-variable/*`, nicht mehr von Google. Familiennamen heißen „Outfit Variable“ usw.
- Chat-Liste in einer Abfrage statt einer pro Chat.

## Design und Psychologie (Migration 0016)

- Text auf Terrakotta-Flächen ist dunkel (`text-onfill`, 5,7:1), die Markenfarbe `#E07A5F` bleibt. Weiß auf Terrakotta hatte 2,8:1. `muted` ist `#6f6159` (5,3:1), `accent-deep` ist `#a8462f`. Eigene Designs setzen `--color-onfill` aus ihrer Akzent-Lesbarkeit.
- Chips und Knöpfe mindestens 44 px hoch. Linsen sind gefüllt (aktiv schwarz), Unterkategorien terrakotta.
- Leerer Feed: erst das Positive (nächster Tag mit Treffen), sonst „Ich hätte Lust“ als Hauptknopf.
- Antwortzeit des Gastgebers (`join_requests.responded_at`), erst ab drei beantworteten Anfragen sichtbar.
- Bestätigung am Vortag (`confirmed_at`): Karte „Bist du morgen dabei?“ in den letzten 30 Stunden. „Doch nicht“ setzt den Status auf `withdrawn` und gibt den Platz frei. Es gibt keinen Hintergrunddienst, der unbeantwortete Plätze automatisch freigibt.
- Countdown und „Wer noch dabei ist“ nur für Gastgeber und Zugesagte.
- Karten-Chip „N Treffen geleitet“ ab zwei vergangenen Treffen.
- Anlegen in drei Schritten. Wichtig: die Knöpfe haben `key`, sonst wird „Weiter“ zum Absenden-Knopf und veröffentlicht sofort.

## Moderation (Migration 0017)

- Admin ist, wessen E-Mail in `ADMIN_EMAILS` steht (kommagetrennt, nur Umgebungsvariable, nicht in der Datenbank). Seite `/admin/meldungen`, Link in den Einstellungen nur für Admins.
- Aktionen: Abweisen, Inhalt entfernen (Treffen wird abgesagt, Anzeige gelöscht), Konto sperren und Entsperren. Wer meldet, bekommt danach eine Mitteilung.
- Gesperrte Konten werfen in `ensureProfile` den Fehler „Dein Konto ist gesperrt“ und kommen nicht mehr in die App.
- Erledigte Meldungen stehen nur im Reiter „Alle“.

## Startreife-Runde (Migrationen 0018, 0019)

- 18+: Seite `/alter` (Geburtsjahr, Haken, Zustimmung) sperrt die App, bis `profiles.age_confirmed_at` gesetzt ist. Server prüft in `requestJoin`, `createActivity`, `expressInterest`, `createClassified` über `assertAdult`. Das Geburtsjahr ist eine Selbstauskunft, keine Prüfung.
- „Profil bestätigt“ ist nicht mehr anklickbar. Nur ein Admin setzt es (`setVerified`, Knopf auf dem Profil). Beispiel-Profile tragen es nicht mehr.
- Begrenzung: `throttle()` über `rate_events` (Anfragen 20/Std., Nachrichten 40/Min., Treffen 10/Tag, Anzeigen 10/Tag, Meldungen 10/Std., Wünsche 20/Std.).
- Bilder: `validImage` prüft Typ, Magic Bytes und Größe. Es gibt keine automatische Inhaltsprüfung (nackt, Gewalt).
- `memberMiddleware` statt `authMiddleware` in `api.ts`: sperrt gesperrte Konten bei jedem Aufruf (30 Sekunden Zwischenspeicher je Server).
- Chat lädt alle 4 Sekunden nach (`usePolling`, `refresh` ohne Flackern). Nachrichten: die letzten 200.
- Feed blättert (`limit`, „Mehr zeigen“).
- E-Mail über Resend, nur mit `RESEND_API_KEY` und `MAIL_FROM` (und `APP_URL` für Links). Passwort vergessen läuft über eigene Funktionen (`requestPasswordReset`, `resetPassword`, Seite `/passwort`), weil `server.ts` eingefroren ist. Mails zu Anfragen und Zusagen sind in den Einstellungen abschaltbar.
- Admin: `/admin/zahlen` (Konten, Anfragen, unbeantwortet über 24 Std., Fehler) und `/admin/meldungen`. Fehler aus dem Browser landen in `error_log`.
- Termin: „Zum Kalender“ (.ics) und „Karte öffnen“ am Treffen.
- Seiten: Nutzungsbedingungen, Community-Regeln (beide Entwürfe).
- Tests: `npm run test:unit` (Orte, Kalender), `npm run test:e2e` (vier Browser-Durchläufe, siehe `e2e/README.md`). CI in `.github/workflows/ci.yml`, auf GitHub noch nicht gelaufen. `npm test` bleibt rot wegen Grok-Umgebungstests.
- Barrierefreiheit mit axe geprüft: keine Befunde auf den geprüften Seiten. Das ersetzt keine Prüfung mit Screenreader.
- Sicherheit: Review der Serverfunktionen. Behoben: Bewertungsabfrage nur für Beteiligte, Weiterleitung nach Login lässt `/\` nicht mehr durch, gesperrte Konten überall draußen.

## Qualitätsrunde (Migration 0020)

- Behoben: Check-in nur von 2 Stunden vor bis 12 Stunden nach Beginn. Zusagen können das Treffen nicht überbuchen (Gegenprüfung nach dem Eintragen, `overbooked`). Serien bleiben über die Sommerzeit auf derselben Uhrzeit (`addDaysBerlin` in `time.ts`, getestet). Chat-Benachrichtigungen werden je Chat zusammengefasst.
- Ungelesen: `chat_reads`, Punkt in Chat-Liste, Zahl an „Chats“ in der Navigation (`chatUnread`, alle 30 Sekunden). Öffnen eines Chats markiert gelesen.
- Karte: „Mira und 2 weitere sind dabei“ (nur Freunde, die zugesagt haben) oder „Passt zu deinen Interessen“. Nicht personalisiert sortiert, weiterhin nach Zeit.
- Einstellungen: „Daten herunterladen“ (`exportMyData`, JSON).
- Einladungsseite liefert beim Laden auf dem Server `og:`-Tags, damit WhatsApp eine Vorschau zeigt. Private Seiten sind `noindex`, `public/robots.txt` sperrt sie zusätzlich. Sicherheits-Header über `routeRules` in `vite.config.ts` (bewusst ohne X-Frame-Options, die Grok-Vorschau läuft in einem Rahmen).
- Design: folgt dem Dunkelmodus des Handys (ein eigenes Design aus den Einstellungen gewinnt), Illustrationen in leeren Zuständen (`Illustration`, `Empty art=`), ruhige Bestätigungen oben (`notice` aus `feel.ts`, sonner), eigene Nachrichten erscheinen sofort, weiche Seitenwechsel (View Transitions), Skelette beim Laden, Ort und Radius stehen oben im Feed, Offline-Leiste. Overlays über Fotos bleiben schwarz (`bg-black/…`), nicht `ink`, sonst kippen sie im Dunkelmodus.
- Barrierefreiheit hell und dunkel mit axe geprüft: keine Befunde.

## Bedienung (Migration 0021)

- **Als Nächstes** (`NextUpCard`, `nextUp`): das nächste zugesagte oder eigene Treffen der kommenden 7 Tage steht über dem Feed, mit Countdown, Weg, Einchecken (ab 2 Stunden vorher), Chat (erst wenn jemand zugesagt hat) und „Gut angekommen“.
- **Gut angekommen** (`checkins.safe_at`, `confirmSafe`): die öffentliche Vertrauensseite zeigt dann „Alles gut“.
- **Ein Satz statt Formular** (`parse.ts`, getestet): Regeln, kein Netz, keine KI. Tag, Uhrzeit, Plätze, Dauer, Ort nach „am/im/bei“, Kategorie. Unklares bleibt leer. Der Parser rät nicht.
- **Vorlagen** (`MEETUP_TEMPLATES`, `templateFor`): Plätze, Dauer und ein erster Satz je Kategorie. **Dauer** ist jetzt eine Spalte (`activities.duration_min`) und gilt für Kalender und „Als Nächstes“.
- **Öffentliche Orte** (`venuesNear`, Overpass/OpenStreetMap, `suggestVenues`): Cafés, Parks, Bibliotheken in der Nähe als Chips beim Ort. Fällt still aus, wenn der Dienst nicht antwortet. Ist hier nicht live getestet, nur mit gemocktem Netz.
- **Schnell-Antworten** im Chat am Tag des Treffens (3 Stunden vorher bis 3 Stunden nach dem Ende): `ARRIVAL_REPLIES`.
- **Terminabstimmung** im Chat (`polls`, `poll_votes`): nur Zeitpunkte. Der Gastgeber kann das Ergebnis als neuen Start festlegen, dann verlieren die Bestätigungen „Ich komme“ ihre Gültigkeit und alle bekommen Bescheid.
- **Mitfahren** (`rides`, `ride_riders`): nur für Gastgeber und Zugesagte. Voll heißt voll, geprüft nach dem Eintragen.
- **Zuverlässigkeit** in den Anfragen: „Kam zu 4 von 5 Treffen · 2× bei dir“, nur aus echten Check-ins.
- **Gleich in der Nähe** (`soon` im Feed): nächste vier Stunden, nächstgelegenes zuerst.
- **Kalender abonnieren** (`calendar_tokens`, Route `/kalender/$token`): Link in den Einstellungen, ersetzbar. Wer ihn kennt, sieht Titel und Orte.
- **Karten-Menü**: gedrückt halten oder „Mehr“ an der Karte. Anfragen mit Tempo, Teilen, Weg, Ausblenden. Es geht um Treffen, nicht um Leute.
- Neue Tabellen mit Personenbezug stehen in `deleteAccount`. `exportMyData` enthält auch Fahrten und Abstimmungen.

## Noch schwach, nicht anfassen ohne Auftrag

- Menschen ohne Foto bleiben Buchstaben. Foto ist Pflicht zum Anfragen und zum Veröffentlichen, nicht zum Reinschauen.
- Business und Kleinanzeigen sind nur durch eine Pille von Dates unterschieden.
- Vertrauenszeile auf der Karte ist nur das erste Badge, oft leer.
- Push weckt das Handy nicht zuverlässig.
- Kalender-Route existiert noch neben der Wochentagsleiste.
- Leere Städte wirken tot, weil der Seed in Karlsruhe liegt.
- Dichte in einer Stadt fehlt. Nicht mit neuen Sparten kaschieren.

## Arbeitsregeln in diesem Workspace

- Bestehende Dateien ändern, keine parallele App daneben.
- Keine neuen Dependencies ohne Grund.
- Nach inhaltlichen Änderungen nicht behaupten, das Handy sei aktualisiert.
- Serverfunktionen validieren Eingaben selbst. Keine rohen SQL-Strings aus Nutzereingaben.
- Seed-Nutzer haben IDs wie `seed:mira`. Die nicht benachrichtigen.
- Kategorien: feste Eltern plus eigene Unterkategorien. Eigene tauchen erst in der Suche auf, bis genug Leute sie wählen, dann unter „Andere“.
- Teilen-Dialog: WhatsApp, Instagram, E-Mail, Facebook, TikTok, Nebenan.de. Nicht nur die System-Share-API.
- Logo liegt unter `public/logo-mark.png` und `public/favicon.svg`. Marke: zwei Figuren auf Terrakotta, Wortmarke MeeQo mit terrakottafarbenem Q.

## Ton zum Nutzer

Deutsch, kurz, konkret. Er testet auf dem Handy und vergleicht mit Hinge, Tinder, Meet5 und Spontacts. Ihn interessiert, ob ein Treffen sofort als Karte sichtbar ist, ob Knöpfe aussehen wie Knöpfe, und ob Ort und Sichtbarkeit tun, was er gesagt hat. Keine Strategie-Aufsätze, außer er fragt danach.
