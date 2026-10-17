# Datenschutz-Folgenabschätzung (Entwurf, Art. 35 DSGVO)

**Stand:** Entwurf zur Prüfung durch eine Datenschutzbeauftragte oder einen Rechtsanwalt. Das ist keine Rechtsberatung. Orte mit „[ ]“ sind auszufüllen.

## 1. Beschreibung der Verarbeitung
MeeQo vermittelt Treffen zu Aktivitäten. Dating und Freundschaft sind getrennt, die Absicht ist von Anfang an sichtbar. Beitritt nur auf Anfrage, Vertrauen aus Ja/Nein-Bewertungen nach dem Treffen.

| Daten | Zweck | Rechtsgrundlage | Speicherdauer |
|---|---|---|---|
| Name, E-Mail, Passwort-Hash | Konto | Vertrag (Art. 6 Abs. 1 lit. b) | bis Löschung des Kontos |
| Geburtsjahr, 18+-Bestätigung | Jugendschutz, Altersfilter | Rechtliche Verpflichtung, berechtigtes Interesse | bis Löschung |
| Ort, Koordinaten | Treffen in der Nähe | Vertrag | bis Löschung |
| Profilfoto | Vertrauen, Erkennen vor Ort | Vertrag | bis Löschung |
| Absicht (Dating/Freundschaft) | Trennung der Bereiche | Vertrag | bis Löschung |
| **„Queer“ / „Queerfreundlich“ am eigenen Profil** | Filter, Profilangabe | **Ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a)** | bis Widerruf oder Löschung |
| Treffen, Anfragen, Chats, Dateien in Chats | Durchführung | Vertrag | bis Löschung, Chats mit dem Konto |
| Check-in, „Gut angekommen“, Vertrauenslink | Sicherheit | Berechtigtes Interesse, Einwilligung beim Teilen | Link bis Widerruf |
| Bewertungen | Vertrauen | Berechtigtes Interesse | bis Löschung |
| Meldungen, Sperren | Sicherheit | Berechtigtes Interesse | [ ] |
| Sprachaufnahme (Browser-Erkennung) | Diktat im Chat | Einwilligung (Nutzer löst aus) | nicht bei uns gespeichert |

Empfänger: Hoster [ ], Datenbank-Anbieter [ ], Mail-Dienst [ ], bei Bedarf Nominatim/OpenPLZ (nur Suchbegriff), Open-Meteo (nur gerundete Koordinaten), Overpass (Orte).

## 2. Notwendigkeit und Verhältnismäßigkeit
- Besondere Kategorien nur mit Einwilligung, getrennt eingeholt, widerrufbar mit Löschfolge.
- Datensparsamkeit: Geburtsjahr statt -datum, Koordinaten gerundet für Wetter, keine Tracker, Schriften lokal gehostet.
- Betroffenenrechte: Auskunft/Export und Löschung in den Einstellungen („Meine Daten“, „Konto löschen“).

## 3. Risiken für Betroffene
| Risiko | Schwere | Wahrscheinlichkeit | Maßnahme |
|---|---|---|---|
| Offenlegung der sexuellen Orientierung durch Profilangabe oder Datenleck | hoch | niedrig | Einwilligung, keine Weitergabe, Zugriffsschutz, Verschlüsselung der Verbindung, Backups verschlüsselt |
| Stalking/Belästigung durch Standort oder Treffendaten | hoch | mittel | Blockieren, Melden, Sichtbarkeit pro Treffen, ungefährer Ort bis Zusage [prüfen], Rate-Limits |
| Fake-Konten, Betrug | mittel | mittel | Foto Pflicht für Anfragen, Telefonbestätigung [geplant], Meldewege |
| Minderjährige | hoch | niedrig | 18+-Bestätigung; Altersnachweis (EU-App/Anbieter) [geplant] |
| Dateien in Chats (Bild/PDF) mit Schadinhalt | mittel | niedrig | Typ- und Dateikopfprüfung, nur Chat-Mitglieder, Größenlimit, Rate-Limit; Virenscan [geplant] |
| Sensible Daten in Freitext (Chats, Profiltexte) | mittel | mittel | Hinweis in Regeln, Löschung mit Konto |

## 4. Offene Punkte vor dem Start
1. Rechtliche Prüfung dieser Folgenabschätzung, der Datenschutzerklärung und der Einwilligungstexte.
2. Auftragsverarbeitungsverträge mit Hoster, Datenbank und Mail-Dienst.
3. Verzeichnis von Verarbeitungstätigkeiten (Art. 30), Löschkonzept, Meldeprozess für Datenpannen (72 Stunden).
4. Altersnachweis-Konzept (DSA Art. 28, EU-Alterscheck-App).
5. Entscheidung, ob die Spracheingabe (Browserdienst) in der Erklärung als Drittdienst genannt wird (Google/Apple je nach Browser).
